import {
  Controller,
  Post,
  Get,
  Req,
  Headers,
  HttpStatus,
  HttpCode,
  Injectable,
  RawBodyRequest,
  BadRequestException,
  InternalServerErrorException,
  Param,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';
import { Request } from 'express'; // Import express Request

@Controller('stripe/webhook') // Define a specific path for webhooks
export class StripeWebhookController {
  constructor(private readonly stripeService: StripeService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return {
      status: 'healthy',
      endpoints: {
        platform: '/stripe/webhook/platform',
        connect: '/stripe/webhook/connect',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('platform')
  @HttpCode(HttpStatus.OK) // Send 200 OK back to Stripe on success
  async handlePlatformWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!req.rawBody) {
      throw new BadRequestException(
        'Raw body not available. Ensure rawBody parser is enabled in main.ts.',
      );
    }

    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(
        req.rawBody,
        signature,
        'platform',
      );
    } catch (err) {
      console.error(
        `Platform webhook signature verification failed: ${err.message}`,
      );
      // For signature verification errors, return 400 (Stripe won't retry)
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    try {
      // Handle platform events
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.stripeService.handlePaymentIntentSucceeded(event);
          break;
        case 'payment_intent.processing':
          await this.stripeService.handlePaymentIntentProcessing(event);
          break;
        case 'payment_intent.payment_failed':
          await this.stripeService.handlePaymentIntentFailed(event);
          break;
        case 'payment_intent.canceled':
          await this.stripeService.handlePaymentIntentCanceled(event);
          break;
        case 'refund.updated':
          await this.stripeService.handleRefundUpdated(event);
          break;
        case 'application_fee.created':
          await this.stripeService.handleApplicationFeeCreated(event);
          break;
        case 'application_fee.refund.updated':
          await this.stripeService.handleApplicationFeeRefundUpdated(event);
          break;
        default:
          console.log(`Unhandled platform event type ${event.type}`);
      }

      // Return success response to Stripe
      return { received: true, id: event.id, type: 'platform' };
    } catch (error) {
      // Log detailed error information
      console.error('Error processing platform webhook:', {
        eventId: event.id,
        eventType: event.type,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        data: JSON.stringify(event.data.object).substring(0, 1000), // Log first 1000 chars of event data
      });

      // For validation/data errors, return 400 (Stripe won't retry)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // For other errors, return 500 (Stripe will retry)
      throw new InternalServerErrorException(
        `Failed to process platform webhook: ${error.message}`,
      );
    }
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async handleConnectWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!req.rawBody) {
      throw new BadRequestException(
        'Raw body not available. Ensure rawBody parser is enabled in main.ts.',
      );
    }

    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(
        req.rawBody,
        signature,
        'connect',
      );
    } catch (err) {
      console.error(
        `Connect webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    // Verify this is a connected account event (has account field)
    if (!event.account) {
      console.warn(`Connect webhook received platform event: ${event.type}`);
      throw new BadRequestException('Connect webhook received platform event');
    }

    try {
      // Handle connected account events
      switch (event.type) {
        case 'account.updated':
          await this.stripeService.handleAccountUpdateWebhook(event);
          break;
        case 'payout.paid':
          await this.stripeService.handlePayoutPaid(event);
          break;
        case 'payout.failed':
          await this.stripeService.handlePayoutFailed(event);
          break;
        default:
          console.log(
            `Unhandled connected account event type ${event.type} for account ${event.account}`,
          );
      }

      return {
        received: true,
        id: event.id,
        type: 'connect',
        account: event.account,
      };
    } catch (error) {
      console.error('Error processing connect webhook:', {
        eventId: event.id,
        eventType: event.type,
        account: event.account,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        data: JSON.stringify(event.data.object).substring(0, 1000),
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to process connect webhook: ${error.message}`,
      );
    }
  }
}
