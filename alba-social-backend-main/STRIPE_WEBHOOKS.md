# Stripe Webhooks Setup

This application uses a two-endpoint approach for handling Stripe webhooks:

## Endpoints

### 1. Platform Webhook (`/stripe/webhook/platform`)

Handles events that occur on the platform level:

- `payment_intent.succeeded`
- `payment_intent.processing`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `refund.updated`
- `application_fee.created`
- `application_fee.refund.updated`

### 2. Connected Account Webhook (`/stripe/webhook/connect`)

Handles events that occur on connected accounts:

- `account.updated`
- `payout.paid`
- `payout.failed`
- `payout.updated`
- `payout.canceled`
- `transfer.created`
- `transfer.updated`
- `transfer.reversed`

## Setup Instructions

### 1. Configure Platform Webhook

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Navigate to **Developers → Webhooks**
3. Click **Add endpoint**
4. Set the URL to: `https://your-domain.com/stripe/webhook/platform`
5. Select the following events:
   - `payment_intent.succeeded`
   - `payment_intent.processing`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `refund.updated`
   - `application_fee.created`
   - `application_fee.refund.updated`
6. Save the endpoint

### 2. Configure Connected Account Webhooks

Connected account webhooks are registered programmatically when you create a connected account. The system will automatically register the webhook endpoint for each new connected account.

### 3. Environment Variables

Make sure you have these environment variables set:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Platform webhook secret
WEBHOOK_BASE_URL=https://your-domain.com  # Optional, for setup script
```

### 4. Testing

#### Local Testing with Stripe CLI

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward webhooks to your local server:

   ```bash
   # For platform events
   stripe listen --forward-to localhost:3000/stripe/webhook/platform

   # For connected account events
   stripe listen --forward-to localhost:3000/stripe/webhook/connect --account acct_xxx
   ```

#### Test Events

```bash
# Test platform events
stripe trigger payment_intent.succeeded

# Test connected account events
stripe trigger payout.paid --account acct_xxx
```

### 5. Health Check

You can check if your webhooks are working by visiting:

```
GET /stripe/webhook/health
```

This will return:

```json
{
  "status": "healthy",
  "endpoints": {
    "platform": "/stripe/webhook/platform",
    "connect": "/stripe/webhook/connect"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Troubleshooting

### Common Issues

1. **"No signatures found matching the expected signature"**

   - Ensure raw body parsing is enabled (already configured in `main.ts`)
   - Check that your webhook secret matches the one in Stripe Dashboard
   - Verify you're using the correct endpoint URL

2. **"Platform webhook received connected account event"**

   - Make sure you're sending platform events to `/stripe/webhook/platform`
   - Connected account events should go to `/stripe/webhook/connect`

3. **"Connect webhook received platform event"**
   - Make sure you're sending connected account events to `/stripe/webhook/connect`
   - Platform events should go to `/stripe/webhook/platform`

### Debugging

The webhook controllers include detailed logging. Check your application logs for:

- Event type and ID
- Account information (for connected account events)
- Error details and stack traces

## Security

- Webhook signatures are verified for all requests
- Raw body parsing ensures the request body isn't modified
- Separate endpoints prevent event type confusion
- Detailed error logging helps with debugging
