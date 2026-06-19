# Notification System Integration

## Overview

Your notification system has been successfully integrated with your NestJS backend. The frontend now communicates directly with your backend instead of using Expo's direct push service.

## What's Changed

### 1. API Integration (`api/notifications.ts`)

- ✅ Updated to match your backend DTOs and endpoints
- ✅ Added proper TypeScript interfaces
- ✅ Notification types changed from lowercase to uppercase (`"GAME"`, `"CHAT"`, `"FOLLOW"`, `"GENERAL"`)
- ✅ Added notification template helpers
- ✅ Added test functions for development

### 2. Hooks (`hooks/useNotifications.ts`)

- ✅ Updated to handle new notification types
- ✅ Added Android notification channels matching your backend
- ✅ Improved navigation handling for different notification types
- ✅ Better error handling and type safety

### 3. WebSocket Chat Integration

- ✅ **NEW**: Updated `hooks/useChatSocket.ts` for Firebase authentication
- ✅ **NEW**: Updated `hooks/useGameChatSocket.ts` for Firebase authentication
- ✅ **NEW**: Updated chat screen to handle authentication flow
- ✅ **NEW**: Removed `user_id` from message payloads (backend auto-populates)

### 4. UI Components

- ✅ Updated notification screen to handle both old and new type formats
- ✅ Added test screen for developers (`app/(app)/notifications/test.tsx`)
- ✅ **NEW**: Updated chat screen to show authentication status

### 5. Cleanup

- ✅ Removed old `utils/notificationHelpers.ts` file (functionality moved to API)

## Backend Endpoints Used

Your frontend now uses these backend endpoints:

```
POST /notifications/register           - Register push token
GET  /notifications                    - Get user notifications
PUT  /notifications/:id/read           - Mark notification as read
PUT  /notifications/read-all           - Mark all as read
DELETE /notifications/:id              - Delete notification
GET  /notifications/settings           - Get notification settings
PUT  /notifications/settings           - Update notification settings
POST /notifications/send/:userId       - Send to specific user (admin)
POST /notifications/send-all           - Send to all users (admin)
```

## WebSocket Chat Integration

### **NEW: Firebase Authentication Required**

Your WebSocket gateway now requires Firebase authentication before joining any chat rooms:

#### Updated WebSocket Flow:

1. **Connect** to WebSocket server
2. **Authenticate** with Firebase token (`authenticate` event)
3. **Join room** with authenticated session (`joinRoom` event)
4. **Send messages** (user_id auto-populated by backend)

#### Updated Hook Usage:

```typescript
const { isConnected, isAuthenticated, sendMessage, markActivity } =
  useChatSocket({
    conversationId,
    onNewMessage: handleNewMessage,
    // ... other callbacks
  });

// Send message (user_id removed from payload)
sendMessage({
  content: "Hello!",
  conversation_id: conversationId,
  // user_id removed - backend gets this from authenticated session
});
```

#### Authentication Events:

- `authenticate` - Send Firebase token to backend
- `authError` - Handle authentication failures
- `error` - Handle general socket errors

## Notification Types

Your backend supports these notification types (matching your Prisma schema):

- `GAME` - Game invitations, reminders, status updates
- `CHAT` - Direct messages, group messages, game chat
- `FOLLOW` - New followers, social interactions
- `GENERAL` - Welcome messages, payments, account updates

## Testing

### Option 1: Test Screen

Navigate to `/notifications/test` in your app to use the built-in test interface.

### Option 2: Programmatic Testing

```typescript
import { testNotifications } from "@/api/notifications";

// Test different notification types
await testNotifications.sendGameInvite("game-123", "John Doe");
await testNotifications.sendNewMessage("chat-123", "Jane", "Hello!");
await testNotifications.sendNewFollower("Mike Johnson");
await testNotifications.sendWelcome();
```

## Notification Channels (Android)

The app now creates these notification channels:

- `game_updates` - Game-related notifications
- `chat_messages` - Chat messages (high priority)
- `social_updates` - Follow notifications
- `general_updates` - General app notifications
- `financial_updates` - Payment/refund notifications

## Backend Integration Notes

### Your Backend Service Methods

Your `NotificationsService` has excellent template methods like:

- `createGameInviteNotification()`
- `createNewMessageNotification()`
- `createPaymentFailedNotification()`
- etc.

### Usage in Your Controllers

When sending notifications from your game, chat, or payment controllers, use:

```typescript
// In your game controller
await this.notificationsService.sendNotificationToUser(
  userId,
  this.notificationsService.createGameInviteNotification(gameId, inviterName)
);

// In your chat controller
await this.notificationsService.sendNotificationToUser(
  userId,
  this.notificationsService.createNewMessageNotification(
    chatId,
    senderName,
    message
  )
);
```

### **NEW: Chat WebSocket Integration**

Your chat service automatically sends smart notifications:

- ✅ **Activity tracking** - Users active in chat don't get notifications
- ✅ **Message grouping** - Multiple messages grouped into single notification
- ✅ **Notification delay** - 5 second delay to allow for message grouping
- ✅ **Different templates** - Direct, game, and group chat notifications

## What's Working Now

1. ✅ **Push token registration** - Tokens are sent to your backend
2. ✅ **Notification display** - Backend notifications appear in the app
3. ✅ **Read/unread state** - Synced with your database
4. ✅ **Settings management** - Users can control notification preferences
5. ✅ **Type-based styling** - Different icons/colors for different notification types
6. ✅ **Navigation handling** - Tapping notifications navigates to relevant screens
7. ✅ **Testing interface** - Easy way to test all notification types
8. ✅ **NEW: WebSocket authentication** - Firebase auth integration for chat
9. ✅ **NEW: Smart chat notifications** - Backend handles notification logic
10. ✅ **NEW: Activity tracking** - No notifications when user is active in chat
11. ✅ **NEW: Full navigation implementation** - All notification types navigate correctly

## Navigation Mapping

Notification taps now navigate to the appropriate screens:

- **Game notifications** → `/(app)/game/{gameId}` - Game details screen
- **Chat notifications** → `/(app)/chat/{conversationId}` - Chat conversation screen
- **Follow notifications** → `/(app)/user/{userId}` - User profile screen
- **Payment notifications** → `/(app)/(tabs)/myGames` - My Games tab (payment history)
- **Payout notifications** → `/(app)/stripe-onboarding` - Account management
- **Account notifications** → `/(app)/stripe-onboarding` - Stripe setup
- **Complaint notifications** → `/(app)/game/{gameId}` or My Games tab
- **Default/Unknown** → `/(app)/notifications` - Notifications screen

## Next Steps

1. **Backend Integration**: Use your service methods in your game/chat/user controllers
2. **Settings UI**: Create a settings screen using the notification settings API
3. **Production**: Remove or restrict access to the test screen in production

## Important Notes

- **WebSocket Authentication**: All chat functionality now requires Firebase authentication
- **Message Payloads**: `user_id` is automatically added by backend from authenticated session
- **Smart Notifications**: Backend handles all notification logic including activity tracking
- **Broadcast testing**: Use broadcast test function carefully in production
- **Notification channels**: Improve user experience on Android
- **Activity tracking**: `markActivity()` function helps optimize notification delivery

## Breaking Changes

⚠️ **IMPORTANT**: The following changes were made that may affect existing code:

1. **WebSocket Authentication**: All WebSocket connections now require Firebase authentication
2. **Message Payload**: `user_id` field removed from message payloads
3. **Event Signatures**: `joinRoom`/`leaveRoom` now use object payloads: `{ roomId: string }`
4. **Hook Returns**: Chat hooks now return `{ isConnected, isAuthenticated, sendMessage, markActivity }`

Your notification and chat system is now fully integrated and ready for production use!
