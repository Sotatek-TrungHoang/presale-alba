import { NotificationType } from '@prisma/client';

export class NotificationEntity {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: string;
  read: boolean;
  type: NotificationType;
}
