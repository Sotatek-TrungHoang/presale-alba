import { Test, TestingModule } from '@nestjs/testing';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeService } from './stripe.service';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import Stripe from 'stripe';

// Mock StripeService
const mockStripeService = {
  constructWebhookEvent: jest.fn(),
  handleAccountUpdateWebhook: jest.fn(),
  handlePaymentIntentSucceeded: jest.fn(),
  handlePaymentIntentProcessing: jest.fn(),
  handlePaymentIntentFailed: jest.fn(),
  handlePaymentIntentCanceled: jest.fn(),
  handleRefundUpdated: jest.fn(),
  handlePayoutPaid: jest.fn(),
  handlePayoutFailed: jest.fn(),
  handleApplicationFeeCreated: jest.fn(),
  handleApplicationFeeRefundUpdated: jest.fn(),
};

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let stripeService: typeof mockStripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
      ],
    }).compile();

    controller = module.get<StripeWebhookController>(StripeWebhookController);
    stripeService = module.get(StripeService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handlePlatformWebhook', () => {
    const mockSignature = 'test_signature';
    const mockRawBody = Buffer.from('{"test": "payload"}');
    const mockRequest = {
      rawBody: mockRawBody,
    } as RawBodyRequest<Request>;

    it('should throw BadRequestException if stripe-signature header is missing', async () => {
      await expect(
        controller.handlePlatformWebhook(undefined, mockRequest),
      ).rejects.toThrow(new BadRequestException('Missing Stripe signature'));
    });

    it('should throw BadRequestException if request rawBody is missing', async () => {
      const reqWithoutBody = {} as RawBodyRequest<Request>;
      await expect(
        controller.handlePlatformWebhook(mockSignature, reqWithoutBody),
      ).rejects.toThrow(
        new BadRequestException(
          'Raw body not available. Ensure rawBody parser is enabled in main.ts.',
        ),
      );
    });

    it('should throw BadRequestException if constructWebhookEvent fails', async () => {
      const constructError = new Error('Invalid signature');
      stripeService.constructWebhookEvent.mockImplementation(() => {
        throw constructError;
      });

      await expect(
        controller.handlePlatformWebhook(mockSignature, mockRequest),
      ).rejects.toThrow(
        new BadRequestException(`Webhook Error: ${constructError.message}`),
      );
    });

    it('should call handlePaymentIntentSucceeded for payment_intent.succeeded events', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        object: 'payment_intent',
        // other properties as needed by the service method
      } as Stripe.PaymentIntent;

      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: {
          object: mockPaymentIntent,
        },
        created: 1620000000,
      } as Stripe.Event;

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      await controller.handlePlatformWebhook(mockSignature, mockRequest);

      expect(stripeService.handlePaymentIntentSucceeded).toHaveBeenCalledTimes(
        1,
      );
      expect(stripeService.handlePaymentIntentSucceeded).toHaveBeenCalledWith(
        mockEvent,
      );
    });

    it('should call handleApplicationFeeRefundUpdated for application_fee.refund.updated events', async () => {
      const mockFeeRefund = {
        id: 'fr_test_123',
        object: 'fee_refund',
        fee: 'fee_test_123',
      } as any; // Using 'any' as Stripe.FeeRefund type might not be directly available in test scope

      const mockEvent = {
        id: 'evt_fee_refund_123',
        type: 'application_fee.refund.updated',
        data: {
          object: mockFeeRefund,
        },
        created: 1620000000,
      } as Stripe.Event;

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      await controller.handlePlatformWebhook(mockSignature, mockRequest);

      expect(
        stripeService.handleApplicationFeeRefundUpdated,
      ).toHaveBeenCalledTimes(1);
      expect(
        stripeService.handleApplicationFeeRefundUpdated,
      ).toHaveBeenCalledWith(mockEvent);
    });

    it('should re-throw BadRequestException from the service', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: { object: {} },
        created: 1620000000,
      } as Stripe.Event;

      const serviceError = new BadRequestException('Invalid data provided.');
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      stripeService.handlePaymentIntentSucceeded.mockRejectedValue(
        serviceError,
      );

      await expect(
        controller.handlePlatformWebhook(mockSignature, mockRequest),
      ).rejects.toThrow(serviceError);
    });

    it('should convert other service errors to InternalServerErrorException', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: { object: {} },
        created: 1620000000,
      } as Stripe.Event;

      const serviceError = new Error('Database connection lost');
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      stripeService.handlePaymentIntentSucceeded.mockRejectedValue(
        serviceError,
      );

      await expect(
        controller.handlePlatformWebhook(mockSignature, mockRequest),
      ).rejects.toThrow(
        new InternalServerErrorException(
          `Failed to process platform webhook: ${serviceError.message}`,
        ),
      );
    });
  });
});
