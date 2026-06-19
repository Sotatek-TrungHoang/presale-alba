import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationDeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushNotificationService } from '../../notifications/push-notification.service';
import { PaginateNotificationsDto } from './dto/paginate-notifications.dto';

const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async findAllPaginated(dto: PaginateNotificationsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { deleted_at: null };
    if (dto.userId) where.user_id = dto.userId;
    if (dto.type) where.type = dto.type;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          user: { include: { profile: true } },
          deliveries: { orderBy: { created_at: 'asc' } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Re-queries Expo for receipts against every ticket on the notification and
   * writes back the verdict. Any delivery that comes back as
   * DeviceNotRegistered causes the associated PushToken to be deactivated so
   * future sends skip it.
   */
  async refreshDeliveryStatus(notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, deleted_at: null },
      include: { deliveries: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const ticketIds = notification.deliveries
      .map((d) => d.ticket_id)
      .filter((id): id is string => !!id);

    if (ticketIds.length === 0) {
      return this.loadWithDeliveries(notificationId);
    }

    const outcomes =
      await this.pushNotificationService.checkNotificationReceipts(ticketIds);

    const tokenIdsToDeactivate = new Set<string>();

    for (const delivery of notification.deliveries) {
      if (!delivery.ticket_id) continue;
      const outcome = outcomes.get(delivery.ticket_id);
      if (!outcome) continue;

      if (outcome.status === 'ok') {
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.SENT,
            error_code: null,
            error_message: null,
          },
        });
      } else {
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.ERROR,
            error_code: outcome.errorCode ?? null,
            error_message: outcome.errorMessage,
          },
        });
        if (
          outcome.errorCode === DEVICE_NOT_REGISTERED &&
          delivery.push_token_id
        ) {
          tokenIdsToDeactivate.add(delivery.push_token_id);
        }
      }
    }

    if (tokenIdsToDeactivate.size > 0) {
      await this.prisma.pushToken.updateMany({
        where: { id: { in: Array.from(tokenIdsToDeactivate) } },
        data: { is_active: false },
      });
      this.logger.log(
        `Deactivated ${tokenIdsToDeactivate.size} push token(s) after DeviceNotRegistered receipt`,
      );
    }

    return this.loadWithDeliveries(notificationId);
  }

  private async loadWithDeliveries(notificationId: string) {
    return this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
      include: {
        deliveries: {
          orderBy: { created_at: 'asc' },
        },
      },
    });
  }
}
