# Notifications System

This module provides a comprehensive push notification system for the Alba golf app using Expo push notifications.

## Features

- **Push Token Management**: Register and manage Expo push tokens for users
- **Notification History**: Store all notifications in the database for history tracking
- **User Preferences**: Configurable notification settings by type (game, chat, follow, general)
- **Expo Integration**: Full Expo push notification support with error handling
- **Batch Notifications**: Send notifications to multiple users efficiently
- **Notification Templates**: Pre-built templates for common scenarios

## Database Models

### PushToken

Stores user device tokens for push notifications.

- `user_id`: Reference to User
- `token`: Expo push token
- `platform`: "ios" or "android"
- `is_active`: Whether the token is currently active

### Notification

Stores notification history for each user.

- `user_id`: Reference to User
- `title`: Notification title
- `body`: Notification body
- `data`: JSON data for additional context
- `type`: NotificationType (GAME, CHAT, FOLLOW, GENERAL)
- `read`: Whether the notification has been read

### NotificationSettings

User preferences for different notification types.

- `user_id`: Reference to User
- `game_notifications`: Enable/disable game notifications
- `chat_notifications`: Enable/disable chat notifications
- `follow_notifications`: Enable/disable follow notifications
- `general_notifications`: Enable/disable general notifications

## API Endpoints

### User Endpoints

- `POST /notifications/register` - Register push token
- `GET /notifications` - Get user's notifications
- `PUT /notifications/:id/read` - Mark notification as read
- `PUT /notifications/read-all` - Mark all notifications as read
- `DELETE /notifications/:id` - Delete notification
- `GET /notifications/settings` - Get notification preferences
- `PUT /notifications/settings` - Update notification preferences

### Admin Endpoints

- `POST /notifications/send/:userId` - Send notification to specific user
- `POST /notifications/send-all` - Send notification to all users

## Usage Examples

### 1. Register Push Token (Frontend)

```typescript
import { registerPushToken } from '@/api/notifications';

// Register the token when the app starts
const token = await Notifications.getExpoPushTokenAsync();
await registerPushToken({
  token: token.data,
  platform: Platform.OS,
});
```

### 2. Send Game Invitation (Backend)

```typescript
// In your GamesService
constructor(
  private notificationsService: NotificationsService,
  // ... other dependencies
) {}

async invitePlayerToGame(gameId: string, inviterId: string, invitedUserId: string) {
  // ... create invitation logic ...

  // Send notification
  const inviter = await this.getUser(inviterId);
  const notification = this.notificationsService.createGameInviteNotification(
    gameId,
    inviter.profile?.first_name || 'Someone'
  );

  await this.notificationsService.sendNotificationToUser(invitedUserId, notification);
}
```

### 3. Send Chat Message Notification (Backend)

```typescript
// In your ChatService/MessagesService
async sendMessage(senderId: string, conversationId: string, content: string) {
  // ... save message logic ...

  // Get conversation participants
  const participants = await this.getConversationParticipants(conversationId);
  const sender = await this.getUser(senderId);

  const notification = this.notificationsService.createNewMessageNotification(
    conversationId,
    sender.profile?.first_name || 'Someone',
    content
  );

  // Send to all participants except sender
  for (const participant of participants) {
    if (participant.user_id !== senderId) {
      await this.notificationsService.sendNotificationToUser(
        participant.user_id,
        notification
      );
    }
  }
}
```

### 4. Send Follow Notification (Backend)

```typescript
// In your RelationshipsService
async followUser(followerId: string, followingId: string) {
  // ... create follow relationship ...

  // Send notification
  const follower = await this.getUser(followerId);
  const notification = this.notificationsService.createNewFollowerNotification(
    follower.profile?.first_name || 'Someone'
  );

  await this.notificationsService.sendNotificationToUser(followingId, notification);
}
```

## Integration Steps

### 1. Add to Existing Services

To integrate notifications into your existing services:

1. **Import NotificationsModule** in your service's module:

```typescript
@Module({
  imports: [NotificationsModule, /* other imports */],
  // ...
})
```

2. **Inject NotificationsService** in your service:

```typescript
constructor(
  private notificationsService: NotificationsService,
  // ... other dependencies
) {}
```

3. **Call notification methods** at appropriate times in your business logic.

### 2. Common Integration Points

#### Games Module

- **Game invitations**: When a user invites another to a game
- **Game reminders**: 30 minutes before game starts (use cron job)
- **Game cancellations**: When a game is cancelled
- **Player joined**: When someone joins your game

#### Messages Module

- **New messages**: When a message is sent in a conversation
- **Added to group**: When someone is added to a group chat

#### Relationships Module

- **New followers**: When someone follows you
- **Follow requests**: If you implement a follow request system

#### Auth Module

- **Welcome messages**: When a user signs up

### 3. Cron Jobs for Reminders

Set up cron jobs for time-based notifications:

```typescript
// Install: npm install @nestjs/schedule
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationScheduler {
  constructor(private notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendGameReminders() {
    // Find games starting in 30 minutes
    const upcomingGames = await this.findGamesStartingSoon();

    for (const game of upcomingGames) {
      await this.notificationsService.sendGameReminder(
        game.id,
        game.start_time,
      );
    }
  }
}
```

## Notification Templates

The service includes pre-built templates for common scenarios:

```typescript
// Game notifications
createGameInviteNotification(gameId, inviterName)
createGameReminderNotification(gameId, gameTime)
createGameCancelledNotification(gameId, reason?)

// Chat notifications
createNewMessageNotification(chatId, senderName, messagePreview)

// Follow notifications
createNewFollowerNotification(followerName)

// General notifications
createWelcomeNotification()
```

## Error Handling

The system includes comprehensive error handling:

- **Invalid tokens**: Automatically filtered out
- **Missing users**: Gracefully handled
- **Network failures**: Logged and retried where appropriate
- **Disabled notifications**: Respected based on user preferences

## Testing

Create test files following the pattern:

```typescript
// notifications.service.spec.ts
describe('NotificationsService', () => {
  // Mock PrismaService and PushNotificationService
  // Test each method with various scenarios
});
```

## Monitoring

Monitor notification delivery through:

- **Database logs**: All notifications are stored in the database
- **Application logs**: Push notification service logs success/failure
- **Expo dashboards**: Monitor delivery rates and errors

## Best Practices

1. **Respect user preferences**: Always check notification settings before sending
2. **Batch operations**: Use batch sending for multiple users
3. **Rate limiting**: Don't spam users with too many notifications
4. **Meaningful content**: Ensure notifications provide value
5. **Deep linking**: Include proper data for navigation in the app
6. **Testing**: Test on both iOS and Android devices
7. **Graceful degradation**: Handle cases where push notifications fail

## Future Enhancements

Potential improvements:

- **Rich notifications**: Images, buttons, etc.
- **Scheduled notifications**: Send at optimal times
- **A/B testing**: Test different notification content
- **Analytics**: Track open rates and engagement
- **Web push**: Support for web notifications
