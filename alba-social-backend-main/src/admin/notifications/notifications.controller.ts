import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { AdminNotificationsService } from './notifications.service';
import { PaginateNotificationsDto } from './dto/paginate-notifications.dto';

@ApiTags('admin')
@Controller('admin/notifications')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications (Admin only)',
    description:
      'Returns a paginated list of notifications with their recipient user and delivery rows. Optionally filter by recipient user id or notification type.',
  })
  findAll(@Query() dto: PaginateNotificationsDto) {
    return this.adminNotificationsService.findAllPaginated(dto);
  }

  @Post(':id/check-delivery')
  @ApiOperation({
    summary: 'Refresh delivery status for a notification (Admin only)',
    description:
      'Fetches Expo receipts for every ticket recorded against this notification, updates each delivery row with the latest status, and deactivates any push token that Expo reports as DeviceNotRegistered.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the notification',
  })
  checkDelivery(@Param('id') id: string) {
    return this.adminNotificationsService.refreshDeliveryStatus(id);
  }
}
