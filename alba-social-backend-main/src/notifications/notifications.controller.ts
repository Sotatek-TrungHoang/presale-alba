import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Register push token
   */
  @Post('register')
  async registerPushToken(
    @Request() req: any,
    @Body() registerTokenDto: RegisterTokenDto,
  ) {
    const userId = await this.getUserIdFromFirebaseUid(req.user.uid);
    await this.notificationsService.registerPushToken(userId, registerTokenDto);
    return { success: true };
  }

  /**
   * Get user's notifications
   */
  @Get()
  async getNotifications(@Request() req: any) {
    const userId = await this.getUserIdFromFirebaseUid(req.user.uid);
    return this.notificationsService.getUserNotifications(userId);
  }

  /**
   * Mark notification as read
   */
  @Put(':id/read')
  async markNotificationAsRead(
    @Request() req: any,
    @Param('id') notificationId: string,
  ) {
    const userId = await this.getUserIdFromFirebaseUid(req.user.uid);
    await this.notificationsService.markNotificationAsRead(
      userId,
      notificationId,
    );
    return { success: true };
  }

  /**
   * Mark all notifications as read
   */
  @Put('read-all')
  async markAllNotificationsAsRead(@Request() req: any) {
    const userId = await this.getUserIdFromFirebaseUid(req.user.uid);
    await this.notificationsService.markAllNotificationsAsRead(userId);
    return { success: true };
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  async deleteNotification(
    @Request() req: any,
    @Param('id') notificationId: string,
  ) {
    const userId = await this.getUserIdFromFirebaseUid(req.user.uid);
    await this.notificationsService.deleteNotification(userId, notificationId);
    return { success: true };
  }

  /**
   * Send notification to specific user (admin function)
   */
  @Post('send/:userId')
  async sendNotificationToUser(
    @Param('userId') targetUserId: string,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    await this.notificationsService.sendNotificationToUser(
      targetUserId,
      createNotificationDto,
    );
    return { success: true };
  }

  /**
   * Send notification to all users (admin function)
   */
  @Post('send-all')
  async sendNotificationToAll(
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    await this.notificationsService.sendNotificationToAll(
      createNotificationDto,
    );
    return { success: true };
  }

  /**
   * Get notification settings
   */
  @Get('settings')
  async getNotificationSettings(@Request() req: any) {
    const userId = await this.getUserIdFromFirebaseUid(req.user.uid);
    return this.notificationsService.getUserNotificationSettings(userId);
  }

  /**
   * Update notification settings
   */
  @Put('settings')
  async updateNotificationSettings(
    @Request() req: any,
    @Body() updateDto: UpdateNotificationSettingsDto,
  ) {
    const userId = await this.getUserIdFromFirebaseUid(req.user.uid);
    return this.notificationsService.updateNotificationSettings(
      userId,
      updateDto,
    );
  }

  /**
   * Helper method to get user ID from Firebase UID
   */
  private async getUserIdFromFirebaseUid(firebaseUid: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.id;
  }
}
