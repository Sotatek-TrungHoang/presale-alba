# Notification System Setup Guide

## Overview

Your app now has a complete push notification system that can:

- Request notification permissions
- Get and register push tokens with your backend
- Handle incoming notifications (foreground and background)
- Display notifications in a dedicated screen
- Mark notifications as read/unread
- Delete notifications
- Navigate to specific screens when notifications are tapped

## What's Been Added

### 1. Core Files

- `hooks/useNotifications.ts` - Main notification hook
- `providers/NotificationProvider.tsx` - Global notification context
- `api/notifications.ts` - Backend API functions
- `utils/notificationHelpers.ts` - Backend helper functions and examples
- `components/NotificationTest.tsx` - Development testing component

### 2. Updated Files

- `app/_layout.tsx` - Added NotificationProvider
- `app/(app)/notifications/index.tsx` - Enhanced notification screen

## How It Works

### Frontend (Mobile App)

1. **Permission Request**: Automatically requests notification permissions when the app starts
2. **Token Generation**: Gets an Expo push token and sends it to your backend
3. **Notification Handling**: Listens for incoming notifications and handles user taps
4. **UI**: Displays notifications in a list with read/unread states

### Backend Integration

Your backend needs these endpoints:

- `POST /notifications/register` - Store user's push token
- `GET /notifications` - Get user's notifications
- `PUT /notifications/:id/read` - Mark notification as read
- `PUT /notifications/read-all` - Mark all notifications as read
- `DELETE /notifications/:id` - Delete notification

## Testing During Development

### Option 1: Use the Test Component

Add the `NotificationTest` component to any screen temporarily:

```tsx
import { NotificationTest } from "@/components/NotificationTest";

// Add this to any screen for testing
<NotificationTest />;
```

### Option 2: Use Expo's Web Tool

1. Visit https://expo.dev/notifications
2. Paste your push token (get it from the test component)
3. Send test notifications

### Option 3: Use cURL

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "title": "Test",
    "body": "Hello from cURL!",
    "data": { "type": "general" }
  }'
```

## Backend Implementation

### Database Schema

Add these fields to your User model:

```sql
-- Add to your users table
pushToken VARCHAR(255),
platform VARCHAR(10), -- 'ios' or 'android'
notificationSettings JSON, -- Optional: user preferences
```

### Example Backend Endpoints (Node.js/Express)

```javascript
// 1. Register push token
app.post("/api/notifications/register", async (req, res) => {
  const { token, platform } = req.body;
  const userId = req.user.id;

  await db.user.update({
    where: { id: userId },
    data: { pushToken: token, platform },
  });

  res.json({ success: true });
});

// 2. Send notification to user
app.post("/api/notifications/send/:userId", async (req, res) => {
  const { userId } = req.params;
  const { title, body, data } = req.body;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { pushToken: true },
  });

  if (user?.pushToken) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: user.pushToken,
        title,
        body,
        data,
        sound: "default",
        priority: "high",
      }),
    });
  }

  res.json({ success: true });
});
```

## Common Notification Types

### Game Notifications

```javascript
// Game invitation
{
  title: 'New Game Invitation',
  body: 'John invited you to join a game',
  data: { type: 'game', gameId: '123', action: 'invite' }
}

// Game reminder
{
  title: 'Game Reminder',
  body: 'Your game starts in 30 minutes',
  data: { type: 'game', gameId: '123', action: 'reminder' }
}
```

### Chat Notifications

```javascript
{
  title: 'Message from John',
  body: 'Hey, are you still up for golf tomorrow?',
  data: { type: 'chat', chatId: '456', action: 'new_message' }
}
```

### Follow Notifications

```javascript
{
  title: 'New Follower',
  body: 'John started following you',
  data: { type: 'follow', action: 'new_follower' }
}
```

## Production Checklist

### Before Going Live

1. ✅ Add Apple Push Notification credentials to EAS
2. ✅ Add Firebase credentials to EAS (recommended)
3. ✅ Remove `NotificationTest` component
4. ✅ Test on physical devices (not simulators)
5. ✅ Implement proper error handling in backend
6. ✅ Add notification settings/preferences
7. ✅ Test notification delivery rates

### EAS Build Commands

```bash
# Development build (for testing)
eas build --profile development --platform ios
eas build --profile development --platform android

# Production build
eas build --profile production --platform ios
eas build --profile production --platform android
```

## Troubleshooting

### Common Issues

1. **"Must use physical device"** - Push notifications don't work on simulators
2. **"Failed to get push token"** - Check permissions and credentials
3. **Notifications not arriving** - Verify token is being sent to backend
4. **iOS notifications not working** - Ensure APNs credentials are set up in EAS

### Debug Steps

1. Check console logs for token generation
2. Verify token is being sent to backend
3. Test with Expo's web tool
4. Check notification permissions in device settings
5. Verify backend is sending to correct Expo endpoint

## Next Steps

1. **Implement Backend Endpoints**: Add the notification endpoints to your backend
2. **Add Notification Settings**: Let users control which notifications they receive
3. **Implement Deep Linking**: Handle navigation when notifications are tapped
4. **Add Analytics**: Track notification open rates and engagement
5. **Optimize Delivery**: Implement retry logic and delivery tracking

## Files to Remove Before Production

- `components/NotificationTest.tsx` - Development testing only
- Any temporary test code in your screens

## Support

- [Expo Notifications Documentation](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo Push API Reference](https://docs.expo.dev/push-notifications/sending-notifications/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
