import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerStatus, ComplaintType, ComplaintStatus } from '@prisma/client';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { StripeService } from '../stripe/stripe.service';
import { RefundReason } from '../stripe/dto/create-refund.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { reportNotificationFailure } from '../notifications/notification-error';

export interface CreateComplaintDto {
  type: ComplaintType;
  description: string;
}

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Allow a player (not the organiser) to log a complaint against a game they played in.
   * For now we only verify the player is APPROVED on the game. Additional business
   * rules (time-window, duplicate check, etc.) can be layered on later.
   */
  async createComplaint(
    authId: string,
    gameId: string,
    dto: CreateComplaintDto,
  ) {
    // 1. Fetch user by auth ID
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Fetch game incl. players
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
        course: true,
        creator: {
          include: { profile: true },
        },
      },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // 3. Ensure user is an APPROVED player (can be tightened later)
    const isApprovedPlayer = game.players.some(
      (gp) => gp.user_id === user.id && gp.status === PlayerStatus.APPROVED,
    );
    if (!isApprovedPlayer) {
      throw new ForbiddenException(
        'Only approved players in this game can submit a complaint',
      );
    }

    // 4. Persist Complaint using generated Prisma types
    const complaint = await this.prisma.complaint.create({
      data: {
        game: { connect: { id: game.id } },
        complainant: { connect: { id: user.id } },
        type: dto.type,
        description: dto.description,
        status: ComplaintStatus.PENDING,
      },
    });

    // NOTIFICATIONS: Notify game organizer and admins
    try {
      const complainantName = user.profile?.first_name || 'Someone';
      const gameLocation = game.course?.name || game.location || 'a game';

      // // Notify game organizer (if they're not the complainant)
      // if (game.creator_id !== user.id) {
      //   const organizerNotification =
      //     this.notificationsService.createNewComplaintNotification(
      //       complaint.id,
      //       dto.type,
      //       gameLocation,
      //       complainantName,
      //     );
      //   await this.notificationsService.sendNotificationToUser(
      //     game.creator_id,
      //     organizerNotification,
      //   );
      // }

      // Notify all admin users
      const adminUsers = await this.prisma.user.findMany({
        where: { admin_status: true, deleted_at: null },
      });

      if (adminUsers.length > 0) {
        const adminNotification =
          this.notificationsService.createAdminComplaintNotification(
            complaint.id,
            dto.type,
            gameLocation,
            complainantName,
          );

        for (const admin of adminUsers) {
          await this.notificationsService.sendNotificationToUser(
            admin.id,
            adminNotification,
          );
        }
      }
    } catch (error) {
      reportNotificationFailure('complaint notifications', error);
    }

    return complaint;
  }

  async getGameComplaints(gameId: string) {
    // 1. Ensure the game exists
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    // 2. Return all complaints for the game (not soft-deleted)
    return this.prisma.complaint.findMany({
      where: { game_id: gameId, deleted_at: null },
      include: {
        complainant: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async resolveComplaint(
    adminAuthId: string,
    complaintId: string,
    dto: ResolveComplaintDto,
  ) {
    // 1. Check admin
    const admin = await this.prisma.user.findUnique({
      where: { auth_id: adminAuthId },
    });
    if (!admin || !admin.admin_status) {
      throw new ForbiddenException('Only admins can resolve complaints');
    }
    // 2. Find complaint with game and complainant details
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        game: {
          include: { course: true },
        },
        complainant: {
          include: { profile: true },
        },
      },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // 3. Update complaint
    const updateData: any = {
      status: dto.status,
      resolution: dto.resolution,
      resolved_by: admin.id,
    };

    let refundAmount = 0;

    // 4. Handle refund logic if status is REFUNDED
    if (dto.status === ComplaintStatus.REFUNDED) {
      const refund = await this.processRefund(complaint, adminAuthId);
      refundAmount = refund.amount || 0;
    }

    const updatedComplaint = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: updateData,
    });

    // NOTIFICATIONS: Notify complainant about resolution
    try {
      const gameLocation =
        complaint.game.course?.name || complaint.game.location || 'the game';

      let notification;

      switch (dto.status) {
        case ComplaintStatus.REFUNDED:
          notification =
            this.notificationsService.createComplaintResolvedNotification(
              complaintId,
              dto.resolution ||
                'Your complaint has been resolved with a refund.',
              refundAmount,
            );
          break;
        case ComplaintStatus.RESOLVED:
          notification =
            this.notificationsService.createComplaintResolvedNotification(
              complaintId,
              dto.resolution || 'Your complaint has been resolved.',
            );
          break;
        case ComplaintStatus.REJECTED:
          notification =
            this.notificationsService.createComplaintRejectedNotification(
              complaintId,
              dto.resolution ||
                'Your complaint has been reviewed and rejected.',
            );
          break;
      }

      if (notification) {
        await this.notificationsService.sendNotificationToUser(
          complaint.complainant_id,
          notification,
        );
      }
    } catch (error) {
      reportNotificationFailure('complaint resolution notification', error);
    }

    return updatedComplaint;
  }

  private async processRefund(complaint: any, adminAuthId: string) {
    // Find the complainant's game player record to get payment details
    const gamePlayer = await this.prisma.gamePlayer.findFirst({
      where: {
        game_id: complaint.game_id,
        user_id: complaint.complainant_id,
        has_paid: true,
        stripe_payment_id: { not: null },
      },
      include: {
        game: true,
      },
    });

    if (!gamePlayer || !gamePlayer.stripe_payment_id) {
      throw new ForbiddenException(
        'Cannot process refund: No payment found for this complaint',
      );
    }

    if (gamePlayer.refunded) {
      throw new ForbiddenException(
        'Cannot process refund: Payment has already been refunded',
      );
    }

    try {
      // Process refund through Stripe
      const refund = await this.stripeService.createRefund(adminAuthId, {
        paymentIntentId: gamePlayer.stripe_payment_id,
        reason: RefundReason.REQUESTED_BY_CUSTOMER,
        amount: gamePlayer.game.cost_per_player,
      });

      // Update game player record to mark as refunded
      await this.prisma.gamePlayer.update({
        where: { id: gamePlayer.id },
        data: {
          refunded: true,
          refund_date: new Date(),
          has_paid: false, // Reset payment status
        },
      });

      // Update game payment status if needed
      const game = await this.prisma.game.findUnique({
        where: { id: complaint.game_id },
        include: {
          players: { where: { deleted_at: null } },
        },
      });

      if (game) {
        const allPlayersPaid = game.players.every((p) => p.has_paid);
        const somePlayersPaid = game.players.some((p) => p.has_paid);

        let newPaymentStatus = game.payment_status;
        if (!somePlayersPaid) {
          newPaymentStatus = 'PARTIALLY_PAID';
        } else if (allPlayersPaid) {
          newPaymentStatus = 'FULLY_PAID';
        } else {
          newPaymentStatus = 'PARTIALLY_PAID';
        }

        if (newPaymentStatus !== game.payment_status) {
          await this.prisma.game.update({
            where: { id: complaint.game_id },
            data: { payment_status: newPaymentStatus },
          });
        }
      }

      return refund;
    } catch (error) {
      throw new ForbiddenException(
        `Failed to process refund: ${error.message}`,
      );
    }
  }
}
