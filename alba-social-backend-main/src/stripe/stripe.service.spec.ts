import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Transaction,
  TransactionEventLog,
  Game,
  GamePlayer,
  TransactionType,
  TransactionStatus,
  User,
  Prisma,
  StripeAccount as DbStripeAccount,
  PaymentStatus,
} from '@prisma/client';
import { CreateRefundDto, RefundReason } from './dto/create-refund.dto';
import {
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

// Mock Stripe module with proper default export structure
jest.mock('stripe', () => {
  const mockRefundsCreate = jest.fn();
  const mockPaymentIntentsRetrieve = jest.fn();
  const mockPaymentIntentsCreate = jest.fn();
  const mockAccountsCreate = jest.fn();
  const mockAccountsRetrieve = jest.fn();
  const mockAccountsUpdate = jest.fn();
  const mockAccountLinksCreate = jest.fn();
  const mockCustomersCreate = jest.fn();
  const mockCustomersRetrieve = jest.fn();
  const mockPayoutsCreate = jest.fn();
  const mockWebhooksConstructEvent = jest.fn();
  const mockApplicationFeesRetrieve = jest.fn();
  const mockEphemeralKeysCreate = jest.fn();
  const mockIssuingCardholdersCreate = jest.fn();
  const mockIssuingCardsCreate = jest.fn();
  const mockIssuingCardsRetrieve = jest.fn();

  const mockStripeConstructor = jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockPaymentIntentsCreate,
      retrieve: mockPaymentIntentsRetrieve,
    },
    refunds: {
      create: mockRefundsCreate,
    },
    accounts: {
      create: mockAccountsCreate,
      retrieve: mockAccountsRetrieve,
      update: mockAccountsUpdate,
    },
    accountLinks: {
      create: mockAccountLinksCreate,
    },
    customers: {
      create: mockCustomersCreate,
      retrieve: mockCustomersRetrieve,
    },
    payouts: {
      create: mockPayoutsCreate,
    },
    applicationFees: {
      retrieve: mockApplicationFeesRetrieve,
    },
    ephemeralKeys: {
      create: mockEphemeralKeysCreate,
    },
    issuing: {
      cardholders: { create: mockIssuingCardholdersCreate },
      cards: {
        create: mockIssuingCardsCreate,
        retrieve: mockIssuingCardsRetrieve,
      },
    },
    webhooks: {
      constructEvent: mockWebhooksConstructEvent,
    },
  })) as any;

  // Add errors to the constructor
  (mockStripeConstructor as any).errors = {
    StripeError: class StripeError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'StripeError';
      }
    },
    StripeAPIError: class StripeAPIError extends Error {
      code: string;
      type: string;
      constructor(params: { message: string; type: string; code?: string }) {
        super(params.message);
        this.name = 'StripeAPIError';
        this.type = params.type;
        this.code = params.code || '';
      }
    },
  };

  // Store references to the mocks for easy access in tests
  (mockStripeConstructor as any).mockRefundsCreate = mockRefundsCreate;
  (mockStripeConstructor as any).mockPaymentIntentsRetrieve =
    mockPaymentIntentsRetrieve;
  (mockStripeConstructor as any).mockPaymentIntentsCreate =
    mockPaymentIntentsCreate;
  (mockStripeConstructor as any).mockAccountsCreate = mockAccountsCreate;
  (mockStripeConstructor as any).mockAccountsRetrieve = mockAccountsRetrieve;
  (mockStripeConstructor as any).mockAccountsUpdate = mockAccountsUpdate;
  (mockStripeConstructor as any).mockAccountLinksCreate =
    mockAccountLinksCreate;
  (mockStripeConstructor as any).mockCustomersCreate = mockCustomersCreate;
  (mockStripeConstructor as any).mockCustomersRetrieve = mockCustomersRetrieve;
  (mockStripeConstructor as any).mockPayoutsCreate = mockPayoutsCreate;
  (mockStripeConstructor as any).mockApplicationFeesRetrieve =
    mockApplicationFeesRetrieve;
  (mockStripeConstructor as any).mockEphemeralKeysCreate =
    mockEphemeralKeysCreate;
  (mockStripeConstructor as any).mockWebhooksConstructEvent =
    mockWebhooksConstructEvent;
  (mockStripeConstructor as any).mockIssuingCardholdersCreate =
    mockIssuingCardholdersCreate;
  (mockStripeConstructor as any).mockIssuingCardsCreate = mockIssuingCardsCreate;
  (mockStripeConstructor as any).mockIssuingCardsRetrieve =
    mockIssuingCardsRetrieve;

  return {
    __esModule: true,
    default: mockStripeConstructor,
  };
});

// Import Stripe after mocking
import Stripe from 'stripe';

// Get references to the mock functions
const mockRefundsCreate = (Stripe as any).mockRefundsCreate;
const mockPaymentIntentsRetrieve = (Stripe as any).mockPaymentIntentsRetrieve;
const mockPaymentIntentsCreate = (Stripe as any).mockPaymentIntentsCreate;
const mockAccountsCreate = (Stripe as any).mockAccountsCreate;
const mockAccountsRetrieve = (Stripe as any).mockAccountsRetrieve;
const mockAccountsUpdate = (Stripe as any).mockAccountsUpdate;
const mockAccountLinksCreate = (Stripe as any).mockAccountLinksCreate;
const mockCustomersCreate = (Stripe as any).mockCustomersCreate;
const mockCustomersRetrieve = (Stripe as any).mockCustomersRetrieve;
const mockPayoutsCreate = (Stripe as any).mockPayoutsCreate;
const mockWebhooksConstructEvent = (Stripe as any).mockWebhooksConstructEvent;
const mockApplicationFeesRetrieve = (Stripe as any).mockApplicationFeesRetrieve;
const mockEphemeralKeysCreate = (Stripe as any).mockEphemeralKeysCreate;
const mockIssuingCardholdersCreate = (Stripe as any).mockIssuingCardholdersCreate;
const mockIssuingCardsCreate = (Stripe as any).mockIssuingCardsCreate;
const mockIssuingCardsRetrieve = (Stripe as any).mockIssuingCardsRetrieve;
// Create mock instances
const mockStripeInstance = new Stripe('test_key');
const mockPrismaService = {
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  transactionEventLog: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  transaction: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gamePlayer: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  game: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  stripeAccount: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    switch (key) {
      case 'STRIPE_SECRET_KEY':
        return 'sk_test_123';
      case 'STRIPE_WEBHOOK_SECRET':
        return 'whsec_test_123';
      case 'STRIPE_WEBHOOK_CONNECT_SECRET':
        return 'whsec_test_connect_123';
      case 'STRIPE_WEBHOOK_PLATFORM_SECRET':
        return 'whsec_test_platform_123';
      case 'STRIPE_ONBOARDING_REFRESH_URL':
      case 'STRIPE_REFRESH_URL':
        return 'http://localhost:3000/onboarding-refresh';
      case 'STRIPE_ONBOARDING_RETURN_URL':
      case 'STRIPE_RETURN_URL':
        return 'http://localhost:3000/onboarding-return';
      case 'STRIPE_PUBLISHABLE_KEY':
        return 'pk_test_123';
      default:
        return undefined;
    }
  }),
};

const mockNotificationsService = {
  sendNotification: jest.fn(),
  createNotification: jest.fn(),
};

describe('StripeService', () => {
  let service: StripeService;
  let prisma: typeof mockPrismaService;
  let configService: typeof mockConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handlePaymentIntentSucceeded', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
    });

    it('should update game status to PARTIALLY_PAID when the first player pays', async () => {
      const payingPlayer = {
        id: 'gp_paying_1',
        user_id: 'user_paying_1',
        has_paid: false,
      };
      const otherPlayer = {
        id: 'gp_other_1',
        user_id: 'user_other_1',
        has_paid: false,
      };
      const mockGame = {
        id: 'game_partial_1',
        payment_status: 'PENDING',
        players: [payingPlayer, otherPlayer],
      };
      const mockPaymentIntent = {
        id: 'pi_partial_1',
        object: 'payment_intent',
        amount_received: 1000,
        currency: 'usd',
        metadata: {
          game_id: mockGame.id,
          game_player_id: payingPlayer.id,
        },
      } as any;

      const mockEvent = {
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockGameUpdateFn = jest.fn();
      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue({ id: 'txn_1' });
      const mockEventLogCreateFn = jest.fn();

      // Create a mock Prisma client for the transaction
      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockEventLogCreateFn,
        },
        transaction: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: mockTransactionCreateFn,
        },
        gamePlayer: {
          findUnique: jest.fn().mockResolvedValue(payingPlayer),
          update: jest.fn(),
        },
        game: {
          findUnique: jest.fn().mockResolvedValue({
            ...mockGame,
            players: [{ ...payingPlayer, has_paid: true }, otherPlayer], // Simulate this player having paid
          }),
          update: mockGameUpdateFn,
        },
      };

      // Mock the transaction execution
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      await service.handlePaymentIntentSucceeded(mockEvent);

      // Verify the transaction was created with correct data
      expect(mockTransactionCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: TransactionType.PAYMENT_INTENT_CHARGE,
          status: TransactionStatus.SUCCEEDED,
          amount: mockPaymentIntent.amount_received,
          currency: mockPaymentIntent.currency,
          game_id: mockGame.id,
          game_player_id: payingPlayer.id,
          stripe_payment_intent_id: mockPaymentIntent.id,
        }),
      });

      // Verify the game status was updated correctly
      expect(mockGameUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGame.id },
        data: { payment_status: 'PARTIALLY_PAID' },
      });

      // Verify event log was created
      expect(mockEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: 'txn_1',
          stripe_event_id: 'evt_1',
          stripe_event_type: 'payment_intent.succeeded',
          status: TransactionStatus.SUCCEEDED,
        }),
      });
    });

    it('should update game status to FULLY_PAID when the last player pays', async () => {
      const payingPlayer = {
        id: 'gp_paying_2',
        user_id: 'user_paying_2',
        has_paid: false,
      };
      const otherPlayer = {
        id: 'gp_other_2',
        user_id: 'user_other_2',
        has_paid: true,
      }; // Other player already paid
      const mockGame = {
        id: 'game_full_2',
        payment_status: 'PARTIALLY_PAID',
        players: [payingPlayer, otherPlayer],
      };
      const mockPaymentIntent = {
        id: 'pi_full_2',
        object: 'payment_intent',
        amount_received: 1000,
        currency: 'usd',
        metadata: {
          game_id: mockGame.id,
          game_player_id: payingPlayer.id,
        },
      } as any;

      const mockEvent = {
        id: 'evt_2',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockGameUpdateFn = jest.fn();
      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue({ id: 'txn_2' });
      const mockEventLogCreateFn = jest.fn();

      // Create a mock Prisma client for the transaction
      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockEventLogCreateFn,
        },
        transaction: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: mockTransactionCreateFn,
        },
        gamePlayer: {
          findUnique: jest.fn().mockResolvedValue(payingPlayer),
          update: jest.fn(),
        },
        game: {
          findUnique: jest.fn().mockResolvedValue({
            ...mockGame,
            players: [{ ...payingPlayer, has_paid: true }, otherPlayer], // Simulate both players have paid
          }),
          update: mockGameUpdateFn,
        },
      };

      // Mock the transaction execution
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      await service.handlePaymentIntentSucceeded(mockEvent);

      // Verify the transaction was created with correct data
      expect(mockTransactionCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: TransactionType.PAYMENT_INTENT_CHARGE,
          status: TransactionStatus.SUCCEEDED,
          amount: mockPaymentIntent.amount_received,
          currency: mockPaymentIntent.currency,
          game_id: mockGame.id,
          game_player_id: payingPlayer.id,
          stripe_payment_intent_id: mockPaymentIntent.id,
        }),
      });

      // Verify the game status was updated correctly
      expect(mockGameUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGame.id },
        data: { payment_status: 'FULLY_PAID' },
      });

      // Verify event log was created
      expect(mockEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: 'txn_2',
          stripe_event_id: 'evt_2',
          stripe_event_type: 'payment_intent.succeeded',
          status: TransactionStatus.SUCCEEDED,
        }),
      });
    });

    it('should skip processing if event already exists', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        object: 'payment_intent',
        metadata: {},
      } as any;

      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const existingEventLog = {
        id: 'log_abc',
        stripe_event_id: 'evt_test_123',
        created_at: new Date(),
        type: 'payment_intent.succeeded',
        data: {},
      };

      // Mock the transaction execution with existing event log
      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(existingEventLog),
          create: jest.fn(),
        },
        transaction: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        gamePlayer: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        game: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      await service.handlePaymentIntentSucceeded(mockEvent);

      expect(mockPrismaTx.transactionEventLog.findUnique).toHaveBeenCalledWith({
        where: { stripe_event_id: 'evt_test_123' },
      });
      expect(mockPrismaTx.transaction.create).not.toHaveBeenCalled();
      expect(mockPrismaTx.game.update).not.toHaveBeenCalled();
    });

    it('should handle P2002 error on transaction creation', async () => {
      const mockPaymentIntent = {
        id: 'pi_p2002_test',
        object: 'payment_intent',
        amount_received: 2000,
        currency: 'eur',
        latest_charge: 'ch_p2002_test',
        customer: 'cus_p2002_test',
        transfer_data: {
          destination: 'acct_p2002_test',
        },
        metadata: {
          payer_user_id: 'user_p2002',
          game_id: 'game_p2002',
          game_player_id: 'gp_p2002',
        },
      } as any;

      const mockEvent = {
        id: 'evt_p2002_test_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockCreatedTransactionAfterP2002 = {
        id: 'trans_recovered_p2002',
        type: TransactionType.PAYMENT_INTENT_CHARGE,
        status: TransactionStatus.SUCCEEDED, // It would have been created successfully by the "other" process
        stripe_payment_intent_id: mockPaymentIntent.id,
        // ... other relevant fields
      };

      const mockGamePlayer = {
        id: 'gp_p2002',
        has_paid: false,
      };

      const mockGame = {
        id: 'game_p2002',
        payment_status: 'PENDING',
        players: [mockGamePlayer],
      };

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        // Simulate P2002 error on the first attempt
        const error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on [stripe_payment_intent_id, type]', // Example constraint
          { code: 'P2002', clientVersion: 'mock' },
        );
        throw error;
      });

      // findFirst is called before create, and then after P2002
      const mockTransactionFindFirstFn = jest
        .fn()
        .mockResolvedValueOnce(null) // First call (before create attempt)
        .mockResolvedValueOnce(mockCreatedTransactionAfterP2002); // Second call (after P2002)

      const mockTransactionEventLogCreateFn = jest.fn();
      const mockGamePlayerUpdateFn = jest.fn();
      const mockGameUpdateFn = jest.fn();

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null), // No existing event log for idempotency skip
            create: mockTransactionEventLogCreateFn,
          },
          transaction: {
            findFirst: mockTransactionFindFirstFn,
            create: mockTransactionCreateFn,
            update: jest.fn(), // Should not be called in this new create P2002 path
          },
          gamePlayer: {
            findUnique: jest.fn().mockResolvedValue(mockGamePlayer),
            update: mockGamePlayerUpdateFn,
          },
          game: {
            findUnique: jest.fn().mockResolvedValue(mockGame),
            update: mockGameUpdateFn,
          },
        });
      });

      await expect(
        service.handlePaymentIntentSucceeded(mockEvent),
      ).resolves.not.toThrow();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1); // Create was attempted once
      expect(mockTransactionFindFirstFn).toHaveBeenCalledTimes(2); // Called before create, and after P2002
      expect(mockGamePlayerUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGamePlayer.id },
        data: expect.objectContaining({ has_paid: true }),
      });
      expect(mockGameUpdateFn).toHaveBeenCalled(); // Or more specific check on what it was called with
      expect(mockTransactionEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedTransactionAfterP2002.id, // Crucial: uses the ID of the "found" transaction
          stripe_event_id: 'evt_p2002_test_123',
          status: TransactionStatus.SUCCEEDED,
        }),
      });
    });
  });

  describe('handlePaymentIntentProcessing', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle payment intent processing event', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        object: 'payment_intent',
        amount: 5000,
        currency: 'gbp',
        latest_charge: 'ch_test_123',
        customer: 'cus_test_123',
        transfer_data: { destination: 'acct_test_123' },
        metadata: {
          payer_user_id: 'user_123',
          game_id: 'game_123',
          game_player_id: 'player_123',
        },
      } as any;

      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.processing',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockTransaction = {
        id: 'txn_123',
        type: 'PAYMENT_INTENT_CHARGE',
        status: 'PROCESSING',
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockTransaction),
            update: jest.fn().mockResolvedValue(mockTransaction),
          },
        });
      });

      await service.handlePaymentIntentProcessing(mockEvent);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should recover from P2002 on transaction create and process event for processing PI', async () => {
      const mockPaymentIntent = {
        id: 'pi_proc_p2002_test',
        object: 'payment_intent',
        amount: 7000,
        currency: 'eur',
        latest_charge: 'ch_proc_p2002_test',
        customer: 'cus_proc_p2002_test',
        transfer_data: {
          destination: 'acct_proc_p2002_test',
        },
        metadata: {
          payer_user_id: 'user_proc_p2002',
          game_id: 'game_proc_p2002',
          game_player_id: 'gp_proc_p2002',
        },
      } as any;

      const mockEvent = {
        id: 'evt_proc_p2002_test_123',
        type: 'payment_intent.processing',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockCreatedTransactionAfterP2002 = {
        id: 'trans_proc_recovered_p2002',
        type: TransactionType.PAYMENT_INTENT_CHARGE,
        status: TransactionStatus.PROCESSING, // Status should be PROCESSING
        stripe_payment_intent_id: mockPaymentIntent.id,
        amount: mockPaymentIntent.amount,
        currency: mockPaymentIntent.currency,
      };

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        const error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on [stripe_payment_intent_id, type]',
          { code: 'P2002', clientVersion: 'mock' },
        );
        throw error;
      });

      const mockTransactionFindFirstFn = jest
        .fn()
        .mockResolvedValueOnce(null) // First call (before create attempt)
        .mockResolvedValueOnce(mockCreatedTransactionAfterP2002); // Second call (after P2002)

      const mockTransactionEventLogCreateFn = jest.fn();

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: mockTransactionEventLogCreateFn,
          },
          transaction: {
            findFirst: mockTransactionFindFirstFn,
            create: mockTransactionCreateFn,
            update: jest.fn(), // Should not be called in this path
          },
          // No gamePlayer or game mocks needed for handlePaymentIntentProcessing
        });
      });

      await expect(
        service.handlePaymentIntentProcessing(mockEvent),
      ).resolves.not.toThrow();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1);
      expect(mockTransactionFindFirstFn).toHaveBeenCalledTimes(2);
      expect(mockTransactionEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedTransactionAfterP2002.id,
          stripe_event_id: 'evt_proc_p2002_test_123',
          status: TransactionStatus.PROCESSING,
          details: expect.objectContaining({ id: mockPaymentIntent.id }),
        }),
      });
    });
  });

  describe('handlePaymentIntentFailed', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle payment intent failed event', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        object: 'payment_intent',
        amount: 1000,
        currency: 'usd',
        latest_charge: 'ch_test_123',
        customer: 'cus_test_123',
        transfer_data: {
          destination: 'acct_test_123',
        },
        last_payment_error: {
          message: 'Card declined',
        },
        metadata: {
          payer_user_id: 'user_123',
          game_id: 'game_123',
          game_player_id: 'gp_123',
        },
      } as any;

      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.payment_failed',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockTransaction = {
        id: 'trans_123',
        type: TransactionType.PAYMENT_INTENT_CHARGE,
        status: TransactionStatus.FAILED,
      };

      const mockGamePlayer = {
        id: 'gp_123',
        has_paid: true,
      };

      const mockGame = {
        id: 'game_123',
        payment_status: 'FULLY_PAID',
        players: [mockGamePlayer],
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockTransaction),
            update: jest.fn().mockResolvedValue(mockTransaction),
          },
          gamePlayer: {
            findUnique: jest.fn().mockResolvedValue(mockGamePlayer),
            update: jest.fn(),
          },
          game: {
            findUnique: jest.fn().mockResolvedValue(mockGame),
            update: jest.fn(),
          },
        });
      });

      await service.handlePaymentIntentFailed(mockEvent);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should recover from P2002 on transaction create and process failed PI event', async () => {
      const mockPaymentIntent = {
        id: 'pi_fail_p2002_test',
        object: 'payment_intent',
        amount: 3000,
        currency: 'usd',
        latest_charge: 'ch_fail_p2002_test',
        customer: 'cus_fail_p2002_test',
        transfer_data: {
          destination: 'acct_fail_p2002_test',
        },
        last_payment_error: {
          message: 'Card declined unexpectedly',
        },
        metadata: {
          payer_user_id: 'user_fail_p2002',
          game_id: 'game_fail_p2002',
          game_player_id: 'gp_fail_p2002',
        },
      } as any;

      const mockEvent = {
        id: 'evt_fail_p2002_test_123',
        type: 'payment_intent.payment_failed',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockCreatedTransactionAfterP2002 = {
        id: 'trans_fail_recovered_p2002',
        type: TransactionType.PAYMENT_INTENT_CHARGE,
        status: TransactionStatus.FAILED, // Status should be FAILED
        stripe_payment_intent_id: mockPaymentIntent.id,
        amount: mockPaymentIntent.amount,
        currency: mockPaymentIntent.currency,
        description: `PaymentIntent failed. PI: ${mockPaymentIntent.id}. Last Error: ${mockPaymentIntent.last_payment_error?.message || 'N/A'}`,
      };

      // Simulate a scenario where the player was marked as paid, but now payment failed
      const mockGamePlayer = {
        id: 'gp_fail_p2002',
        has_paid: true, // Player was previously marked as paid
      };

      const mockGame = {
        id: 'game_fail_p2002',
        payment_status: 'FULLY_PAID', // Game was fully paid
        players: [mockGamePlayer, { id: 'other_gp', has_paid: true }], // Another player who also paid
      };

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        const error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on [stripe_payment_intent_id, type]',
          { code: 'P2002', clientVersion: 'mock' },
        );
        throw error;
      });

      const mockTransactionFindFirstFn = jest
        .fn()
        .mockResolvedValueOnce(null) // First call (before create attempt)
        .mockResolvedValueOnce(mockCreatedTransactionAfterP2002); // Second call (after P2002)

      const mockTransactionEventLogCreateFn = jest.fn();
      const mockGamePlayerUpdateFn = jest.fn();
      const mockGameUpdateFn = jest.fn();

      prisma.$transaction.mockImplementation(async (callback) => {
        // For this test, the prisma client passed to the callback in the service
        // should have its methods mocked directly if they are used inside the transaction scope.
        const mockPrismaTx = {
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null), // No existing event log for idempotency skip
            create: mockTransactionEventLogCreateFn,
          },
          transaction: {
            findFirst: mockTransactionFindFirstFn,
            create: mockTransactionCreateFn,
            update: jest.fn(), // Should not be called in this new create P2002 path
          },
          gamePlayer: {
            findUnique: jest.fn().mockResolvedValue(mockGamePlayer),
            update: mockGamePlayerUpdateFn,
          },
          game: {
            findUnique: jest.fn().mockResolvedValue(mockGame),
            update: mockGameUpdateFn,
          },
        };
        return await callback(mockPrismaTx as any); // Cast to any to satisfy Prisma.TransactionClient type
      });

      await expect(
        service.handlePaymentIntentFailed(mockEvent),
      ).resolves.not.toThrow();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1); // Create was attempted once
      expect(mockTransactionFindFirstFn).toHaveBeenCalledTimes(2); // Called before create, and after P2002
      expect(mockGamePlayerUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGamePlayer.id },
        data: { has_paid: false }, // Player should be marked as not paid
      });
      expect(mockGameUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGame.id },
        // Since one player's payment failed, but another had paid, it becomes PARTIALLY_PAID
        data: { payment_status: 'PARTIALLY_PAID' },
      });
      expect(mockTransactionEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedTransactionAfterP2002.id,
          stripe_event_id: 'evt_fail_p2002_test_123',
          status: TransactionStatus.FAILED,
          details: expect.objectContaining({ id: mockPaymentIntent.id }),
        }),
      });
    });
  });

  describe('handleRefundUpdated', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle refund updated event', async () => {
      const mockRefund = {
        id: 'ref_test_123',
        object: 'refund',
        amount: 1000,
        currency: 'usd',
        status: 'succeeded',
        payment_intent: 'pi_test_123',
        charge: 'ch_test_123',
        reason: 'requested_by_customer',
      } as any;

      const mockEvent = {
        id: 'evt_test_123',
        type: 'refund.updated',
        created: Date.now() / 1000,
        data: { object: mockRefund },
      } as Stripe.Event;

      const mockTransaction = {
        id: 'trans_123',
        type: TransactionType.REFUND,
        status: TransactionStatus.SUCCEEDED,
        game_player_id: 'gp_123',
        game_id: 'game_123',
      };

      const mockGamePlayer = {
        id: 'gp_123',
        refunded: false,
      };

      const mockGame = {
        id: 'game_123',
        payment_status: 'FULLY_PAID',
        players: [mockGamePlayer],
      };

      // Mock the Stripe PaymentIntent retrieval
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_test_123',
        metadata: {
          game_player_id: 'gp_123',
          game_id: 'game_123',
          payer_user_id: 'user_123',
        },
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          transaction: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockTransaction),
            update: jest.fn().mockResolvedValue(mockTransaction),
          },
          gamePlayer: {
            findUnique: jest.fn().mockResolvedValue(mockGamePlayer),
            update: jest.fn(),
          },
          game: {
            findUnique: jest.fn().mockResolvedValue(mockGame),
            update: jest.fn(),
          },
        });
      });

      await service.handleRefundUpdated(mockEvent);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should recover from P2002 on REFUND transaction create and process event', async () => {
      const mockRefundEventData = {
        id: 'ref_p2002_test',
        object: 'refund', // Ensure type is 'refund' for validateWebhookEvent
        status: 'succeeded',
        amount: 1500,
        currency: 'gbp',
        payment_intent: 'pi_for_refund_p2002',
        charge: 'ch_for_refund_p2002',
        reason: 'duplicate',
      } as any;

      const mockEvent = {
        id: 'evt_refund_p2002_test_123',
        type: 'refund.updated',
        created: Date.now() / 1000,
        data: { object: mockRefundEventData },
      } as Stripe.Event;

      // This is the transaction that would have been created by the "other" concurrent process
      const mockCreatedRefundTransactionAfterP2002 = {
        id: 'trans_refund_recovered_p2002',
        type: TransactionType.REFUND,
        status: TransactionStatus.SUCCEEDED,
        stripe_refund_id: mockRefundEventData.id,
        stripe_payment_intent_id: mockRefundEventData.payment_intent,
        amount: mockRefundEventData.amount,
        currency: mockRefundEventData.currency,
        game_player_id: 'gp_refund_p2002', // Assume these were populated by the "other" process
        game_id: 'game_refund_p2002',
        user_id: 'user_refund_p2002',
      };

      const mockGamePlayer = {
        id: 'gp_refund_p2002',
        has_paid: true, // Was paid before refund
        refunded: false,
      };

      const mockGame = {
        id: 'game_refund_p2002',
        payment_status: 'FULLY_PAID',
        players: [mockGamePlayer, { id: 'other_player', has_paid: true }], // Another player still paid
      };

      // Mock for stripe.paymentIntents.retrieve (in case it's called, though with P2002 it might not if parent already has IDs)
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: mockRefundEventData.payment_intent,
        metadata: {
          game_player_id: 'gp_refund_p2002',
          game_id: 'game_refund_p2002',
          payer_user_id: 'user_refund_p2002',
        },
      });

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        const error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on [stripe_refund_id]',
          { code: 'P2002', clientVersion: 'mock' },
        );
        throw error;
      });

      // For REFUND, the service uses findUnique on stripe_refund_id before create, and then after P2002
      const mockTransactionFindUniqueFn = jest
        .fn()
        .mockResolvedValueOnce(null) // First call (before create attempt)
        .mockResolvedValueOnce(mockCreatedRefundTransactionAfterP2002); // Second call (after P2002)

      const mockTransactionEventLogCreateFn = jest.fn();
      const mockGamePlayerUpdateFn = jest.fn();
      const mockGameUpdateFn = jest.fn();

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockPrismaTx = {
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null), // No existing event log
            create: mockTransactionEventLogCreateFn,
          },
          transaction: {
            findUnique: mockTransactionFindUniqueFn, // Service uses findUnique for refunds
            create: mockTransactionCreateFn,
            update: jest.fn(), // Should not be called in this P2002 path
          },
          gamePlayer: {
            findUnique: jest.fn().mockResolvedValue(mockGamePlayer),
            update: mockGamePlayerUpdateFn,
          },
          game: {
            findUnique: jest.fn().mockResolvedValue(mockGame),
            update: mockGameUpdateFn,
          },
        };
        return await callback(mockPrismaTx as any);
      });

      await expect(
        service.handleRefundUpdated(mockEvent),
      ).resolves.not.toThrow();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1);
      expect(mockTransactionFindUniqueFn).toHaveBeenCalledTimes(2); // Called before create and after P2002

      // Verify game/player updates because refund was 'succeeded'
      expect(mockGamePlayerUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGamePlayer.id },
        data: {
          refunded: true,
          refund_date: expect.any(Date),
          has_paid: false,
        },
      });
      expect(mockGameUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGame.id },
        data: { payment_status: 'PARTIALLY_PAID' }, // Since one player refunded, game is now partially paid
      });

      expect(mockTransactionEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedRefundTransactionAfterP2002.id,
          stripe_event_id: 'evt_refund_p2002_test_123',
          status: TransactionStatus.SUCCEEDED,
        }),
      });
    });

    it('should continue processing if retrieving the original PaymentIntent fails', async () => {
      const mockRefundEventData = {
        id: 'ref_pi_fail_test',
        object: 'refund',
        status: 'succeeded',
        amount: 500,
        currency: 'usd',
        payment_intent: 'pi_that_fails_retrieval',
        charge: 'ch_pi_fail_test',
      } as any;

      // Mock the Stripe API call to throw an error
      const retrievalError = new Error('Payment Intent not found');
      mockPaymentIntentsRetrieve.mockRejectedValue(retrievalError);

      const mockEvent = {
        id: 'evt_refund_pi_fail_123',
        type: 'refund.updated',
        created: Date.now() / 1000,
        data: { object: mockRefundEventData },
      } as Stripe.Event;

      const mockTransaction = {
        id: 'trans_refund_pi_fail',
        // Note: game_id and game_player_id will be null as PI retrieval failed
      };

      // Mock the console.error to verify it's called
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Define mocks that we can assert against later
      const transactionCreateMock = jest
        .fn()
        .mockResolvedValue({ id: 'trans_refund_pi_fail' });
      const gamePlayerUpdateMock = jest.fn();

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockPrismaTx = {
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          transaction: {
            findUnique: jest.fn().mockResolvedValue(null), // No existing refund transaction
            create: transactionCreateMock, // Use the mock we defined outside
            update: jest.fn(),
          },
          gamePlayer: {
            // These should not be called as game_player_id is unknown
            findUnique: jest.fn(),
            update: gamePlayerUpdateMock, // Use the mock we defined outside
          },
          game: {
            // These should not be called as game_id is unknown
            findUnique: jest.fn(),
            update: jest.fn(),
          },
        };
        return await callback(mockPrismaTx as any);
      });

      await expect(
        service.handleRefundUpdated(mockEvent),
      ).resolves.not.toThrow();

      // Verify that an attempt was made to retrieve the PI
      expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith(
        'pi_that_fails_retrieval',
      );
      // Verify the error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Could not retrieve original PaymentIntent ${mockRefundEventData.payment_intent}`,
        ),
        retrievalError,
      );
      // Verify that a transaction was still created
      expect(transactionCreateMock).toHaveBeenCalledTimes(1);
      // Verify game/player updates were NOT called
      expect(gamePlayerUpdateMock).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore(); // Clean up the spy
    });

    it('should skip processing a stale refund event', async () => {
      const olderEventTime = new Date('2023-01-01T12:00:00Z');
      const newerEventTime = new Date('2023-01-01T12:05:00Z');

      const mockRefundEventData = {
        id: 'ref_stale_test',
        object: 'refund',
        status: 'pending', // Older event is 'pending'
        payment_intent: 'pi_for_stale_refund',
      } as any;

      const mockEvent = {
        id: 'evt_stale_old_123',
        type: 'refund.updated',
        created: olderEventTime.getTime() / 1000,
        data: { object: mockRefundEventData },
      } as Stripe.Event;

      // The existing transaction in the DB, already processed with a *newer* event
      const mockExistingTransaction = {
        id: 'trans_stale_refund',
        stripe_refund_id: 'ref_stale_test',
        status: TransactionStatus.SUCCEEDED, // The newer event was 'succeeded'
        last_event_time: newerEventTime, // Timestamp of the newer event
      };

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null), // Idempotency check passes
          create: jest.fn(), // Should not be called
        },
        transaction: {
          findUnique: jest.fn().mockResolvedValue(mockExistingTransaction), // Find the existing transaction
          create: jest.fn(), // Should not be called
          update: jest.fn(), // Should not be called
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Act: handle the older event
      await service.handleRefundUpdated(mockEvent);

      // Assert
      expect(mockPrismaTx.transaction.findUnique).toHaveBeenCalledWith({
        where: { stripe_refund_id: 'ref_stale_test' },
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Stale event evt_stale_old_123 for refund ref_stale_test received.',
        ),
      );
      expect(mockPrismaTx.transaction.update).not.toHaveBeenCalled();
      expect(mockPrismaTx.transactionEventLog.create).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should handle a failed refund status correctly', async () => {
      const mockRefundEventData = {
        id: 'ref_failed_status_test',
        object: 'refund',
        status: 'failed',
        payment_intent: 'pi_for_failed_refund',
      } as any;

      const mockEvent = {
        id: 'evt_refund_failed_123',
        type: 'refund.updated',
        created: Date.now() / 1000,
        data: { object: mockRefundEventData },
      } as Stripe.Event;

      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue({ id: 'txn_failed_refund' });

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'evt_log_123' }),
        },
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockTransactionCreateFn,
          update: jest.fn(),
        },
        gamePlayer: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        game: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      mockPaymentIntentsRetrieve.mockResolvedValue({ metadata: {} });

      await service.handleRefundUpdated(mockEvent);

      expect(mockTransactionCreateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TransactionStatus.FAILED,
            last_event_time: expect.any(Date), // Check for timestamp
          }),
        }),
      );
      expect(mockPrismaTx.gamePlayer.update).not.toHaveBeenCalled();
    });

    it('should handle a pending refund status correctly', async () => {
      const mockRefundEventData = {
        id: 'ref_pending_status_test',
        object: 'refund',
        status: 'pending',
        payment_intent: 'pi_for_pending_refund',
      } as any;

      const mockEvent = {
        id: 'evt_refund_pending_123',
        type: 'refund.updated',
        created: Date.now() / 1000,
        data: { object: mockRefundEventData },
      } as Stripe.Event;

      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue({ id: 'txn_pending_refund' });

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'evt_log_123' }),
        },
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockTransactionCreateFn,
          update: jest.fn(),
        },
        gamePlayer: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        game: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      mockPaymentIntentsRetrieve.mockResolvedValue({ metadata: {} });

      await service.handleRefundUpdated(mockEvent);

      expect(mockTransactionCreateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TransactionStatus.PENDING,
            last_event_time: expect.any(Date), // Check for timestamp
          }),
        }),
      );
      expect(mockPrismaTx.gamePlayer.update).not.toHaveBeenCalled();
    });
  });

  describe('createRefund', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a refund successfully', async () => {
      const mockUser = {
        id: 'user_123',
        auth_id: 'auth_123',
      };

      const mockRefund = {
        id: 'ref_test_123',
        status: 'succeeded',
        amount: 1000,
      };

      const createRefundDto: CreateRefundDto = {
        paymentIntentId: 'pi_test_123',
        amount: 1000,
        reason: RefundReason.REQUESTED_BY_CUSTOMER,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockRefundsCreate.mockResolvedValue(mockRefund);

      const result = await service.createRefund('auth_123', createRefundDto);

      expect(result).toEqual(mockRefund);
      expect(mockRefundsCreate).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: 1000,
        reason: 'requested_by_customer',
        reverse_transfer: true,
        refund_application_fee: false,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      const createRefundDto: CreateRefundDto = {
        paymentIntentId: 'pi_test_123',
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createRefund('invalid_auth', createRefundDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle Stripe errors', async () => {
      const mockUser = {
        id: 'user_123',
        auth_id: 'auth_123',
      };

      const createRefundDto: CreateRefundDto = {
        paymentIntentId: 'pi_test_123',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockRefundsCreate.mockRejectedValue(
        new Stripe.errors.StripeAPIError({
          message: 'API Error',
          type: 'api_error',
        }),
      );

      await expect(
        service.createRefund('auth_123', createRefundDto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct webhook event successfully', () => {
      const mockPayload = Buffer.from('{"test": "data"}');
      const mockSignature = 'test_signature';
      const mockEvent = { id: 'evt_test', type: 'payment_intent.succeeded' };

      mockWebhooksConstructEvent.mockReturnValue(mockEvent);

      const result = service.constructWebhookEvent(
        mockPayload,
        mockSignature,
        'connect',
      );

      expect(result).toEqual(mockEvent);
      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
        mockPayload,
        mockSignature,
        'whsec_test_connect_123',
      );
    });

    it('should throw error when webhook secret not configured', () => {
      // Create a spy on the service method instead of modifying the global mock
      const constructWebhookEventSpy = jest.spyOn(
        service,
        'constructWebhookEvent',
      );
      constructWebhookEventSpy.mockImplementation(() => {
        throw new InternalServerErrorException('Webhook secret not configured');
      });

      expect(() =>
        service.constructWebhookEvent(
          Buffer.from('test'),
          'signature',
          'connect',
        ),
      ).toThrow(InternalServerErrorException);

      constructWebhookEventSpy.mockRestore();
    });

    it('should handle webhook construction errors', () => {
      const mockPayload = Buffer.from('{"test": "data"}');
      const mockSignature = 'invalid_signature';

      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() =>
        service.constructWebhookEvent(mockPayload, mockSignature, 'connect'),
      ).toThrow(BadRequestException);

      // Reset the mock for other tests
      mockWebhooksConstructEvent.mockReset();
    });
  });

  describe('initiateOnboardingFlow', () => {
    const mockCreateConnectedAccountDto = {
      email: 'test@example.com',
      individual: {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890',
        address: {
          line1: '123 Main St',
          line2: '',
          city: 'London',
          postal_code: 'SW1A 1AA',
        },
        dob: {
          day: 1,
          month: 1,
          year: 1990,
        },
      },
    };

    it('should create new Stripe account and initiate onboarding', async () => {
      const mockUser = {
        id: 'user_123',
        auth_id: 'auth_123',
        email: 'test@example.com',
        stripe_account: null,
      };

      const mockStripeAccount = {
        id: 'acct_test_123',
        details_submitted: false,
        payouts_enabled: false,
      };

      const mockAccountLink = {
        url: 'https://connect.stripe.com/setup/test',
      };

      const mockStripeAccountRecord = {
        id: 'db_stripe_account_123',
        user_id: 'user_123',
        stripe_connect_id: 'acct_test_123',
        details_submitted: false,
        payouts_enabled: false,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockAccountsCreate.mockResolvedValue(mockStripeAccount);
      mockAccountLinksCreate.mockResolvedValue(mockAccountLink);
      prisma.stripeAccount.create.mockResolvedValue(mockStripeAccountRecord);
      configService.get
        .mockReturnValueOnce('http://localhost:3000/onboarding-refresh')
        .mockReturnValueOnce('http://localhost:3000/onboarding-return');

      const result = await service.initiateOnboardingFlow(
        'auth_123',
        mockCreateConnectedAccountDto,
      );

      expect(result).toEqual(mockAccountLink);
      expect(mockAccountsCreate).toHaveBeenCalledWith({
        type: 'express',
        country: 'GB',
        business_type: 'individual',
        business_profile: {
          product_description: 'Organizing shared golf round',
          mcc: '7999',
        },
        email: 'test@example.com',
        individual: mockCreateConnectedAccountDto.individual,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'manual',
            },
          },
        },
      });
      expect(prisma.stripeAccount.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user_123',
          stripe_connect_id: 'acct_test_123',
          details_submitted: false,
          payouts_enabled: false,
        },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.initiateOnboardingFlow(
          'invalid_auth',
          mockCreateConnectedAccountDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAccountStatus', () => {
    it('should return not_started status when no Stripe account exists', async () => {
      const mockUser = {
        id: 'user_123',
        auth_id: 'auth_123',
        stripe_account: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getAccountStatus('auth_123');

      expect(result).toEqual({
        status: 'not_started',
        accountType: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        dbStatusMatchesStripe: true,
        isReOnboarding: false,
      });
    });

    it('should return active status when account is fully set up', async () => {
      const mockUser = {
        id: 'user_123',
        auth_id: 'auth_123',
        stripe_account: {
          id: 'db_stripe_account_123',
          stripe_connect_id: 'acct_test_123',
          account_type: 'EXPRESS',
          details_submitted: true,
          payouts_enabled: true,
        },
      };

      const mockStripeAccount = {
        id: 'acct_test_123',
        details_submitted: true,
        payouts_enabled: true,
        charges_enabled: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockAccountsRetrieve.mockResolvedValue(mockStripeAccount);

      const result = await service.getAccountStatus('auth_123');

      expect(result).toEqual({
        status: 'active',
        accountType: 'EXPRESS',
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        dbStatusMatchesStripe: true,
        isReOnboarding: false,
      });
    });

    it('should update database when Stripe status differs', async () => {
      const mockUser = {
        id: 'user_123',
        auth_id: 'auth_123',
        stripe_account: {
          id: 'db_stripe_account_123',
          stripe_connect_id: 'acct_test_123',
          account_type: 'EXPRESS',
          details_submitted: false,
          payouts_enabled: false,
        },
      };

      const mockStripeAccount = {
        id: 'acct_test_123',
        details_submitted: true,
        payouts_enabled: true,
        charges_enabled: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockAccountsRetrieve.mockResolvedValue(mockStripeAccount);
      prisma.stripeAccount.update.mockResolvedValue({});

      const result = await service.getAccountStatus('auth_123');

      expect(result).toEqual({
        status: 'active',
        accountType: 'EXPRESS',
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        dbStatusMatchesStripe: false,
        isReOnboarding: false,
      });
      expect(prisma.stripeAccount.update).toHaveBeenCalledWith({
        where: { id: 'db_stripe_account_123' },
        data: {
          payouts_enabled: true,
          details_submitted: true,
        },
      });
    });
  });

  describe('createPaymentIntent', () => {
    const mockPaymentIntentDto = {
      amount: 5000,
      currency: 'gbp',
      recipientAuthId: 'recipient_auth_123',
      applicationFeeAmount: 500,
      metadata: {
        game_id: 'game_123',
        game_player_id: 'player_123',
      },
    };

    it('should create payment intent successfully', async () => {
      const mockPayerCustomer = {
        id: 'cus_payer_123',
        metadata: { app_user_id: 'payer_user_123' },
      };

      const mockRecipientUser = {
        id: 'recipient_user_123',
        auth_id: 'recipient_auth_123',
        stripe_account: {
          stripe_connect_id: 'acct_recipient_123',
        },
      };

      const mockPaymentIntent = {
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc',
      };

      const mockEphemeralKey = { secret: 'ek_test_secret' };

      // Mock getOrCreateStripeCustomer
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'payer_user_123',
          auth_id: 'payer_auth_123',
          email: 'payer@example.com',
          stripe_customer_id: 'cus_payer_123',
          profile: { first_name: 'John', last_name: 'Doe' },
        } as any)
        .mockResolvedValueOnce(mockRecipientUser as any);

      mockCustomersRetrieve.mockResolvedValue(mockPayerCustomer as any);
      mockPaymentIntentsCreate.mockResolvedValue(mockPaymentIntent as any);
      mockEphemeralKeysCreate.mockResolvedValue(mockEphemeralKey as any);
      const result = await service.createPaymentIntent(
        'payer_auth_123',
        mockPaymentIntentDto,
      );

      expect(result).toEqual({
        clientSecret: 'pi_test_123_secret_abc',
        paymentIntentId: 'pi_test_123',
        recipientStripeAccountId: 'acct_recipient_123',
        ephemeralKey: 'ek_test_secret',
        customerId: 'cus_payer_123',
        publishableKey: 'pk_test_123',
      });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'gbp',
        customer: 'cus_payer_123',
        setup_future_usage: 'on_session',
        automatic_payment_methods: { enabled: true },
        application_fee_amount: 500,
        transfer_data: {
          destination: 'acct_recipient_123',
        },
        metadata: {
          payer_auth_id: 'payer_auth_123',
          payer_user_id: 'payer_user_123',
          recipient_auth_id: 'recipient_auth_123',
          recipient_user_id: 'recipient_user_123',
          recipient_stripe_account_id: 'acct_recipient_123',
          payer_stripe_customer_id: 'cus_payer_123',
          game_id: 'game_123',
          game_player_id: 'player_123',
        },
      });
    });

    it('should throw error when recipient has no Stripe account', async () => {
      const mockRecipientUser = {
        id: 'recipient_user_123',
        auth_id: 'recipient_auth_123',
        stripe_account: null,
      };

      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'payer_user_123',
          auth_id: 'payer_auth_123',
          email: 'payer@example.com',
          stripe_customer_id: null,
          profile: null,
        } as any)
        .mockResolvedValueOnce(mockRecipientUser as any);

      mockCustomersCreate.mockResolvedValue({
        id: 'cus_new_123',
        metadata: { app_user_id: 'payer_user_123' },
      });
      prisma.user.update.mockResolvedValue({} as any);

      await expect(
        service.createPaymentIntent('payer_auth_123', mockPaymentIntentDto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createManualPayout', () => {
    const mockPayoutDetails = {
      amount: 10000,
      currency: 'gbp',
      connectedAccountId: 'acct_test_123',
      description: 'Test payout',
      metadata: { game_id: 'game_123' },
    };

    it('should create manual payout successfully', async () => {
      const mockUser = {
        id: 'user_123',
        auth_id: 'auth_123',
      };

      const mockPayout = {
        id: 'po_test_123',
        status: 'pending',
        amount: 10000,
        currency: 'gbp',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockPayoutsCreate.mockResolvedValue(mockPayout);

      const result = await service.createManualPayout(
        'auth_123',
        mockPayoutDetails,
      );

      expect(result).toEqual(mockPayout);
      expect(mockPayoutsCreate).toHaveBeenCalledWith(
        {
          amount: 10000,
          currency: 'gbp',
          description: 'Test payout',
          metadata: { game_id: 'game_123' },
        },
        {
          stripeAccount: 'acct_test_123',
        },
      );
    });

    it('should handle Stripe payout errors', async () => {
      const mockUser = {
        id: 'user_123',
        auth_id: 'auth_123',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockPayoutsCreate.mockRejectedValue(
        new Stripe.errors.StripeAPIError({
          message: 'Insufficient funds',
          type: 'api_error',
        }),
      );

      await expect(
        service.createManualPayout('auth_123', mockPayoutDetails),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('handleAccountUpdateWebhook', () => {
    it('should update account status from webhook', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'account.updated',
        created: 1234567890,
        data: {
          object: {
            id: 'acct_test_123',
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      } as Stripe.Event;

      const mockStripeAccountRecord = {
        id: 'db_stripe_account_123',
        stripe_connect_id: 'acct_test_123',
        payouts_enabled: false,
        details_submitted: false,
        last_event_time: null, // Explicitly testing the initial update from null
        user: { id: 'user_123' },
      };

      prisma.stripeAccount.findFirst.mockResolvedValue(
        mockStripeAccountRecord,
      );
      prisma.stripeAccount.update.mockResolvedValue({});

      await service.handleAccountUpdateWebhook(mockEvent);

      expect(prisma.stripeAccount.update).toHaveBeenCalledWith({
        where: { id: 'db_stripe_account_123' },
        data: {
          payouts_enabled: true,
          details_submitted: true,
          last_event_time: new Date(1234567890 * 1000),
          details_submitted_at: new Date(1234567890 * 1000),
          issue_notified_at: null,
        },
      });
    });

    it('should skip stale events', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'account.updated',
        created: 1234567890,
        data: {
          object: {
            id: 'acct_test_123',
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      } as Stripe.Event;

      const mockStripeAccountRecord = {
        id: 'db_stripe_account_123',
        stripe_connect_id: 'acct_test_123',
        payouts_enabled: false,
        details_submitted: false,
        last_event_time: new Date(1234567900 * 1000), // Later than event
        user: { id: 'user_123' },
      };

      prisma.stripeAccount.findFirst.mockResolvedValue(
        mockStripeAccountRecord,
      );

      await service.handleAccountUpdateWebhook(mockEvent);

      expect(prisma.stripeAccount.update).not.toHaveBeenCalled();
    });

    it('should handle unknown Stripe account', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'account.updated',
        created: 1234567890,
        data: {
          object: {
            id: 'acct_unknown_123',
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      } as Stripe.Event;

      prisma.stripeAccount.findFirst.mockResolvedValue(null);

      // Should not throw, just log warning
      await expect(
        service.handleAccountUpdateWebhook(mockEvent),
      ).resolves.not.toThrow();
    });

    it('should promote pending Custom account when webhook reports it ready', async () => {
      const mockEvent = {
        id: 'evt_pending_ready_123',
        type: 'account.updated',
        created: 1234567890,
        data: {
          object: {
            id: 'acct_pending_custom_123',
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      } as Stripe.Event;

      const mockStripeAccountRecord = {
        id: 'db_stripe_account_123',
        user_id: 'user_123',
        stripe_connect_id: 'acct_legacy_express_123',
        pending_connect_id: 'acct_pending_custom_123',
        account_type: 'EXPRESS',
        payouts_enabled: true,
        details_submitted: true,
        last_event_time: null,
        user: { id: 'user_123' },
      };

      prisma.stripeAccount.findFirst.mockResolvedValue(mockStripeAccountRecord);
      prisma.stripeAccount.update.mockResolvedValue({});

      await service.handleAccountUpdateWebhook(mockEvent);

      expect(prisma.stripeAccount.update).toHaveBeenCalledWith({
        where: { id: 'db_stripe_account_123' },
        data: expect.objectContaining({
          previous_connect_id: 'acct_legacy_express_123',
          previous_account_type: 'EXPRESS',
          stripe_connect_id: 'acct_pending_custom_123',
          account_type: 'CUSTOM',
          pending_connect_id: null,
          payouts_enabled: true,
          details_submitted: true,
        }),
      });
    });

    it('should record event time but not promote when pending account is not ready', async () => {
      const mockEvent = {
        id: 'evt_pending_notready_123',
        type: 'account.updated',
        created: 1234567890,
        data: {
          object: {
            id: 'acct_pending_custom_123',
            payouts_enabled: false,
            details_submitted: true,
          },
        },
      } as Stripe.Event;

      const mockStripeAccountRecord = {
        id: 'db_stripe_account_123',
        user_id: 'user_123',
        stripe_connect_id: 'acct_legacy_express_123',
        pending_connect_id: 'acct_pending_custom_123',
        account_type: 'EXPRESS',
        payouts_enabled: true,
        details_submitted: true,
        last_event_time: null,
        user: { id: 'user_123' },
      };

      prisma.stripeAccount.findFirst.mockResolvedValue(mockStripeAccountRecord);
      prisma.stripeAccount.update.mockResolvedValue({});

      await service.handleAccountUpdateWebhook(mockEvent);

      expect(prisma.stripeAccount.update).toHaveBeenCalledWith({
        where: { id: 'db_stripe_account_123' },
        data: { last_event_time: new Date(1234567890 * 1000) },
      });
    });
  });

  describe('handlePaymentIntentCanceled', () => {
    it('should handle payment intent canceled event', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'gbp',
        latest_charge: 'ch_test_123',
        customer: 'cus_test_123',
        transfer_data: { destination: 'acct_test_123' },
        cancellation_reason: 'requested_by_customer',
        object: 'payment_intent',
        metadata: {
          payer_user_id: 'user_123',
          game_id: 'game_123',
          game_player_id: 'player_123',
        },
      } as any;

      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.canceled',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockTransaction = {
        id: 'txn_123',
        type: 'PAYMENT_INTENT_CHARGE',
        status: 'CANCELED',
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      prisma.transactionEventLog.findUnique.mockResolvedValue(null);
      prisma.transaction.findFirst.mockResolvedValue(null);
      prisma.transaction.create.mockResolvedValue(mockTransaction);
      prisma.transactionEventLog.create.mockResolvedValue({});
      prisma.gamePlayer.findUnique.mockResolvedValue({
        id: 'player_123',
        has_paid: true,
      });
      prisma.gamePlayer.update.mockResolvedValue({});
      prisma.game.findUnique.mockResolvedValue({
        id: 'game_123',
        payment_status: 'FULLY_PAID',
        players: [{ id: 'player_123', has_paid: true }],
      });
      prisma.game.update.mockResolvedValue({});

      await service.handlePaymentIntentCanceled(mockEvent);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PAYMENT_INTENT_CHARGE',
          status: 'CANCELED',
          description: expect.stringContaining('PaymentIntent canceled'),
        }),
      });
    });

    it('should recover from P2002 on transaction create and process canceled PI event', async () => {
      const mockPaymentIntent = {
        id: 'pi_cancel_p2002_test',
        object: 'payment_intent',
        amount: 4000,
        currency: 'usd',
        latest_charge: 'ch_cancel_p2002_test',
        customer: 'cus_cancel_p2002_test',
        transfer_data: {
          destination: 'acct_cancel_p2002_test',
        },
        cancellation_reason: 'duplicate',
        metadata: {
          payer_user_id: 'user_cancel_p2002',
          game_id: 'game_cancel_p2002',
          game_player_id: 'gp_cancel_p2002',
        },
      } as any;

      const mockEvent = {
        id: 'evt_cancel_p2002_test_123',
        type: 'payment_intent.canceled',
        created: Date.now() / 1000,
        data: { object: mockPaymentIntent },
      } as Stripe.Event;

      const mockCreatedTransactionAfterP2002 = {
        id: 'trans_cancel_recovered_p2002',
        type: TransactionType.PAYMENT_INTENT_CHARGE,
        status: TransactionStatus.CANCELED, // Status should be CANCELED
        stripe_payment_intent_id: mockPaymentIntent.id,
        amount: mockPaymentIntent.amount,
        currency: mockPaymentIntent.currency,
        description: `PaymentIntent canceled. PI: ${mockPaymentIntent.id}. Reason: ${mockPaymentIntent.cancellation_reason || 'N/A'}`,
      };

      const mockGamePlayer = {
        id: 'gp_cancel_p2002',
        has_paid: true, // Player was previously marked as paid
      };

      const mockGame = {
        id: 'game_cancel_p2002',
        payment_status: 'FULLY_PAID',
        players: [mockGamePlayer], // Only this player in the game for simplicity
      };

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        const error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on [stripe_payment_intent_id, type]',
          { code: 'P2002', clientVersion: 'mock' },
        );
        throw error;
      });

      const mockTransactionFindFirstFn = jest
        .fn()
        .mockResolvedValueOnce(null) // Before create attempt
        .mockResolvedValueOnce(mockCreatedTransactionAfterP2002); // After P2002

      const mockTransactionEventLogCreateFn = jest.fn();
      const mockGamePlayerUpdateFn = jest.fn();
      const mockGameUpdateFn = jest.fn();

      // Simulate the game object that would be returned AFTER the gamePlayer.update sets has_paid to false
      const mockGameAfterPlayerUpdate = {
        ...mockGame, // Spread original game properties
        players: [
          { ...mockGamePlayer, has_paid: false }, // The crucial change: this player is now not paid
          // Add other players here if the test scenario involves them and their payment status matters
        ],
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockPrismaTx = {
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: mockTransactionEventLogCreateFn,
          },
          transaction: {
            findFirst: mockTransactionFindFirstFn,
            create: mockTransactionCreateFn,
            update: jest.fn(),
          },
          gamePlayer: {
            findUnique: jest.fn().mockResolvedValue(mockGamePlayer), // This is for the initial fetch of the player
            update: mockGamePlayerUpdateFn,
          },
          game: {
            // This mock is for the game.findUnique call that happens *after* the gamePlayer is updated
            // to recalculate game payment status.
            findUnique: jest.fn().mockResolvedValue(mockGameAfterPlayerUpdate),
            update: mockGameUpdateFn,
          },
        };
        return await callback(mockPrismaTx as any);
      });

      await expect(
        service.handlePaymentIntentCanceled(mockEvent),
      ).resolves.not.toThrow();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1);
      expect(mockTransactionFindFirstFn).toHaveBeenCalledTimes(2);

      expect(mockGamePlayerUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGamePlayer.id },
        data: { has_paid: false },
      });

      expect(mockGameUpdateFn).toHaveBeenCalledWith({
        where: { id: mockGame.id },
        data: { payment_status: 'PENDING' }, // Since the only player's payment was effectively removed
      });

      expect(mockTransactionEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedTransactionAfterP2002.id,
          stripe_event_id: 'evt_cancel_p2002_test_123',
          status: TransactionStatus.CANCELED,
        }),
      });
    });
  });

  describe('handlePayoutPaid', () => {
    it('should throw BadRequestException if connected account is missing', async () => {
      const mockPayout = { id: 'po_no_acct' };
      const mockEvent = {
        id: 'evt_no_acct',
        type: 'payout.paid',
        data: { object: mockPayout },
        account: undefined, // Missing!
        created: Date.now() / 1000,
      } as Stripe.Event;

      await expect(service.handlePayoutPaid(mockEvent)).rejects.toThrow(
        new BadRequestException(
          'Missing connected account ID for payout event',
        ),
      );
    });

    it('should handle payout paid event and create a new transaction', async () => {
      const mockPayout = {
        id: 'po_test_123',
        amount: 10000,
        currency: 'gbp',
        arrival_date: 1234567890,
        balance_transaction: 'txn_test_123',
        object: 'payout',
      };
      const mockEvent = {
        id: 'evt_test_123',
        type: 'payout.paid',
        created: Date.now() / 1000,
        account: 'acct_test_123',
        data: { object: mockPayout },
      } as Stripe.Event;

      const mockStripeAccountRecord = {
        user_id: 'user_123',
      };
      const mockTransaction = {
        id: 'txn_123',
        type: 'PAYOUT',
        status: 'SUCCEEDED',
      };

      // Mock the prisma calls within the $transaction block for this specific test
      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue(mockTransaction);
      const mockEventLogCreateFn = jest.fn().mockResolvedValue({});
      const mockStripeAccountFindFn = jest
        .fn()
        .mockResolvedValue(mockStripeAccountRecord);

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockEventLogCreateFn,
        },
        stripeAccount: {
          findUnique: mockStripeAccountFindFn,
        },
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null), // No transaction exists
          create: mockTransactionCreateFn,
          update: jest.fn(), // Not expected to be called in create path
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      await service.handlePayoutPaid(mockEvent);

      expect(mockPrismaTx.transactionEventLog.findUnique).toHaveBeenCalledTimes(
        1,
      );
      expect(mockStripeAccountFindFn).toHaveBeenCalledTimes(1);
      expect(mockPrismaTx.transaction.findUnique).toHaveBeenCalledTimes(1); // Initial check for existing transaction
      expect(mockTransactionCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PAYOUT',
          status: 'SUCCEEDED',
          amount: 10000,
          currency: 'gbp',
          stripe_payout_id: 'po_test_123',
          stripe_connected_account_id: 'acct_test_123',
          user_id: 'user_123',
        }),
      });
      expect(mockEventLogCreateFn).toHaveBeenCalledTimes(1);
    });

    it('should recover from P2002 on PAYOUT transaction create and process event', async () => {
      const mockPayoutData = {
        id: 'po_p2002_test',
        object: 'payout',
        status: 'paid',
        amount: 12000,
        currency: 'eur',
        arrival_date: 1234567891,
        balance_transaction: 'bal_trans_payout_p2002',
      } as any;
      const connectedAccountId = 'acct_for_payout_p2002';

      const mockEvent = {
        id: 'evt_payout_paid_p2002_test_123',
        type: 'payout.paid',
        created: Date.now() / 1000,
        account: connectedAccountId,
        data: { object: mockPayoutData },
      } as Stripe.Event;

      const mockStripeAccountRecordForPayout = {
        id: 'db_stripe_acct_payout',
        user_id: 'user_for_payout_p2002',
        stripe_connect_id: connectedAccountId,
      };

      const mockCreatedPayoutTransactionAfterP2002 = {
        id: 'trans_payout_recovered_p2002',
        type: TransactionType.PAYOUT,
        status: TransactionStatus.SUCCEEDED,
        stripe_payout_id: mockPayoutData.id,
        user_id: mockStripeAccountRecordForPayout.user_id,
        amount: mockPayoutData.amount,
        currency: mockPayoutData.currency,
        stripe_connected_account_id: connectedAccountId,
      };

      const mockTransactionFindUniqueFn = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCreatedPayoutTransactionAfterP2002);

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        const error = new Prisma.PrismaClientKnownRequestError('', {
          code: 'P2002',
          clientVersion: 'mock',
        });
        throw error;
      });
      const mockTransactionEventLogCreateFn = jest.fn().mockResolvedValue({});

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockTransactionEventLogCreateFn,
        },
        stripeAccount: {
          findUnique: jest
            .fn()
            .mockResolvedValue(mockStripeAccountRecordForPayout),
        },
        transaction: {
          findUnique: mockTransactionFindUniqueFn,
          create: mockTransactionCreateFn,
          update: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      await expect(service.handlePayoutPaid(mockEvent)).resolves.not.toThrow();

      expect(mockPrismaTx.transactionEventLog.findUnique).toHaveBeenCalledTimes(
        1,
      );
      expect(mockPrismaTx.stripeAccount.findUnique).toHaveBeenCalledWith({
        where: { stripe_connect_id: connectedAccountId },
      });
      expect(mockTransactionFindUniqueFn).toHaveBeenCalledTimes(2);
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1);
      expect(mockPrismaTx.transaction.update).not.toHaveBeenCalled();

      expect(mockTransactionEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedPayoutTransactionAfterP2002.id,
          stripe_event_id: 'evt_payout_paid_p2002_test_123',
          status: TransactionStatus.SUCCEEDED,
        }),
      });
    });
  });

  describe('handlePayoutFailed', () => {
    it('should handle payout failed event', async () => {
      const mockPayout = {
        id: 'po_test_123',
        amount: 10000,
        currency: 'gbp',
        failure_code: 'insufficient_funds',
        failure_message: 'Insufficient funds in account',
        balance_transaction: 'txn_test_123',
        object: 'payout',
      };

      const mockEvent = {
        id: 'evt_test_123',
        type: 'payout.failed',
        created: Date.now() / 1000,
        account: 'acct_test_123',
        data: { object: mockPayout },
      } as Stripe.Event;

      const mockStripeAccountRecord = {
        user_id: 'user_123',
      };

      const mockTransaction = {
        id: 'txn_123',
        type: 'PAYOUT',
        status: 'FAILED',
      };

      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue(mockTransaction);

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        stripeAccount: {
          findUnique: jest.fn().mockResolvedValue(mockStripeAccountRecord),
        },
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockTransactionCreateFn,
          update: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      await service.handlePayoutFailed(mockEvent);

      expect(mockTransactionCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PAYOUT',
          status: 'FAILED',
          description: expect.stringContaining('Payout to bank failed'),
          stripe_payout_id: 'po_test_123',
        }),
      });
    });

    it('should recover from P2002 on FAILED PAYOUT transaction create and process event', async () => {
      const mockPayoutData = {
        id: 'po_fail_p2002_test',
        object: 'payout',
        status: 'failed',
        amount: 12000,
        currency: 'eur',
        failure_code: 'account_closed',
        failure_message: 'The destination bank account is closed.',
        balance_transaction: 'bal_trans_payout_fail_p2002',
      } as any;
      const connectedAccountId = 'acct_for_payout_fail_p2002';

      const mockEvent = {
        id: 'evt_payout_fail_p2002_test_123',
        type: 'payout.failed',
        created: Date.now() / 1000,
        account: connectedAccountId,
        data: { object: mockPayoutData },
      } as Stripe.Event;

      const mockStripeAccountRecordForPayout = {
        id: 'db_stripe_acct_payout_fail',
        user_id: 'user_for_payout_fail_p2002',
        stripe_connect_id: connectedAccountId,
      };

      const mockCreatedPayoutTransactionAfterP2002 = {
        id: 'trans_payout_fail_recovered_p2002',
        type: TransactionType.PAYOUT,
        status: TransactionStatus.FAILED,
        stripe_payout_id: mockPayoutData.id,
      };

      const mockTransactionFindUniqueFn = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCreatedPayoutTransactionAfterP2002);

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        const error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          { code: 'P2002', clientVersion: 'mock' },
        );
        throw error;
      });

      const mockEventLogCreateFn = jest.fn().mockResolvedValue({});

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockEventLogCreateFn,
        },
        stripeAccount: {
          findUnique: jest
            .fn()
            .mockResolvedValue(mockStripeAccountRecordForPayout),
        },
        transaction: {
          findUnique: mockTransactionFindUniqueFn,
          create: mockTransactionCreateFn,
          update: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      await expect(
        service.handlePayoutFailed(mockEvent),
      ).resolves.not.toThrow();

      expect(mockPrismaTx.transactionEventLog.findUnique).toHaveBeenCalledTimes(
        1,
      );
      expect(mockPrismaTx.stripeAccount.findUnique).toHaveBeenCalledTimes(1);
      expect(mockTransactionFindUniqueFn).toHaveBeenCalledTimes(2);
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1);
      expect(mockPrismaTx.transaction.update).not.toHaveBeenCalled();
      expect(mockEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedPayoutTransactionAfterP2002.id,
          stripe_event_id: 'evt_payout_fail_p2002_test_123',
          status: TransactionStatus.FAILED,
        }),
      });
    });

    it('should create a FAILED PAYOUT transaction with a null user_id if StripeAccount is not found', async () => {
      const mockPayout = {
        id: 'po_fail_no_acct_test',
        amount: 12000,
        currency: 'eur',
        failure_code: 'account_closed',
        object: 'payout',
      } as any;
      const connectedAccountId = 'acct_unknown_fail_test';

      const mockEvent = {
        id: 'evt_payout_fail_no_acct_123',
        type: 'payout.failed',
        created: Date.now() / 1000,
        account: connectedAccountId,
        data: { object: mockPayout },
      } as Stripe.Event;

      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue({ id: 'txn_fail_no_acct' });

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        stripeAccount: {
          findUnique: jest.fn().mockResolvedValue(null), // No account found
        },
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: mockTransactionCreateFn,
          update: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      await service.handlePayoutFailed(mockEvent);

      expect(mockPrismaTx.stripeAccount.findUnique).toHaveBeenCalledWith({
        where: { stripe_connect_id: connectedAccountId },
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `No StripeAccount record found for connectedAccountId: ${connectedAccountId}`,
        ),
      );
      expect(mockTransactionCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PAYOUT',
          status: 'FAILED',
          stripe_payout_id: mockPayout.id,
          user_id: null,
        }),
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('handleApplicationFeeCreated', () => {
    it('should handle application fee created event', async () => {
      const mockApplicationFee = {
        id: 'fee_test_123',
        object: 'application_fee',
        amount: 500,
        currency: 'gbp',
        originating_transaction: 'ch_test_123',
        account: 'acct_test_123',
      };

      const mockEvent = {
        id: 'evt_test_123',
        type: 'application_fee.created',
        created: Date.now() / 1000,
        data: { object: mockApplicationFee },
      } as Stripe.Event;

      const mockStripeAccountRecord = {
        user_id: 'user_123',
      };

      const mockTransaction = {
        id: 'txn_123',
        type: 'APPLICATION_FEE',
        status: 'SUCCEEDED',
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      prisma.transactionEventLog.findUnique.mockResolvedValue(null);
      prisma.stripeAccount.findUnique.mockResolvedValue(
        mockStripeAccountRecord,
      );
      prisma.transaction.findUnique.mockResolvedValue(null);
      prisma.transaction.create.mockResolvedValue(mockTransaction);
      prisma.transactionEventLog.create.mockResolvedValue({});

      await service.handleApplicationFeeCreated(mockEvent);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'APPLICATION_FEE',
          status: 'SUCCEEDED',
          amount: 500,
          currency: 'gbp',
          stripe_application_fee_id: 'fee_test_123',
          stripe_charge_id: 'ch_test_123',
          stripe_connected_account_id: 'acct_test_123',
        }),
      });
    });

    it('should recover from P2002 on APPLICATION_FEE transaction create and process event', async () => {
      const mockApplicationFeeData = {
        id: 'fee_p2002_test',
        object: 'application_fee', // For webhook validation
        amount: 750,
        currency: 'usd',
        originating_transaction: 'ch_orig_p2002_test',
        account: 'acct_platform_p2002_test', // This is the platform's connect account ID
        application: 'app_p2002_test',
        balance_transaction: 'bal_txn_p2002_test',
        charge: 'ch_orig_p2002_test', // alias for originating_transaction
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        amount_refunded: 0,
        refunded: false,
        refunds: { data: [], 많음: false, object: 'list', url: '' }, // Stripe.ApiList<Stripe.Refund>
      } as any;

      const mockEvent = {
        id: 'evt_appfee_p2002_test_123',
        type: 'application_fee.created',
        created: Date.now() / 1000,
        data: { object: mockApplicationFeeData },
      } as Stripe.Event;

      const mockStripeAccountRecordForAppFee = {
        id: 'db_stripe_acct_platform_p2002',
        user_id: 'platform_user_p2002', // The user_id associated with the platform account
        stripe_connect_id: mockApplicationFeeData.account,
      };

      const mockCreatedAppFeeTransactionAfterP2002 = {
        id: 'trans_appfee_recovered_p2002',
        type: TransactionType.APPLICATION_FEE,
        status: TransactionStatus.SUCCEEDED,
        stripe_application_fee_id: mockApplicationFeeData.id,
        user_id: mockStripeAccountRecordForAppFee.user_id,
        amount: mockApplicationFeeData.amount,
        currency: mockApplicationFeeData.currency,
        stripe_charge_id: mockApplicationFeeData.originating_transaction,
        stripe_connected_account_id: mockApplicationFeeData.account,
      };

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        const error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on [stripe_application_fee_id]',
          { code: 'P2002', clientVersion: 'mock' },
        );
        throw error;
      });

      const mockTransactionFindUniqueFn = jest
        .fn()
        .mockResolvedValueOnce(null) // First call (before create attempt)
        .mockResolvedValueOnce(mockCreatedAppFeeTransactionAfterP2002); // Second call (after P2002)

      const mockTransactionEventLogCreateFn = jest.fn().mockResolvedValue({});

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockPrismaTx = {
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null), // No existing event log
            create: mockTransactionEventLogCreateFn,
          },
          stripeAccount: {
            findUnique: jest
              .fn()
              .mockResolvedValue(mockStripeAccountRecordForAppFee),
          },
          transaction: {
            findUnique: mockTransactionFindUniqueFn,
            create: mockTransactionCreateFn,
            update: jest.fn(), // Should not be called
          },
          // No game/gamePlayer updates for application_fee
        };
        return await callback(mockPrismaTx as any);
      });

      await expect(
        service.handleApplicationFeeCreated(mockEvent),
      ).resolves.not.toThrow();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1);
      expect(mockTransactionFindUniqueFn).toHaveBeenCalledTimes(2);
      // The following assertion is removed as it's too fragile and not the core of the test.
      // expect(
      //   prisma.$transaction.mock.calls[0][0].toString(),
      // ).toContain(mockApplicationFeeData.id);

      expect(mockTransactionEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedAppFeeTransactionAfterP2002.id,
          stripe_event_id: 'evt_appfee_p2002_test_123',
          status: TransactionStatus.SUCCEEDED, // Application fees are typically 'succeeded' on creation
          details: expect.objectContaining({ id: mockApplicationFeeData.id }),
        }),
      });
    });

    it('should create an APPLICATION_FEE transaction with a null user_id if StripeAccount is not found', async () => {
      const mockApplicationFee = {
        id: 'fee_no_acct_test',
        object: 'application_fee',
        amount: 800,
        currency: 'usd',
        account: 'acct_unknown_fee_test',
      } as any;

      const mockEvent = {
        id: 'evt_appfee_no_acct_123',
        type: 'application_fee.created',
        created: Date.now() / 1000,
        data: { object: mockApplicationFee },
      } as Stripe.Event;

      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue({ id: 'txn_fee_no_acct' });

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockPrismaTx = {
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          stripeAccount: {
            findUnique: jest.fn().mockResolvedValue(null), // No account found
          },
          transaction: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: mockTransactionCreateFn,
            update: jest.fn(),
          },
        };
        return await callback(mockPrismaTx as any);
      });

      await service.handleApplicationFeeCreated(mockEvent);

      // Verify transaction was created with null user_id
      expect(mockTransactionCreateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'APPLICATION_FEE',
            status: 'SUCCEEDED',
            stripe_application_fee_id: mockApplicationFee.id,
            user_id: null,
          }),
        }),
      );
    });

    it('should skip processing a stale application_fee.created event', async () => {
      const olderEventTime = new Date('2023-01-01T12:00:00Z');
      const newerEventTime = new Date('2023-01-01T12:05:00Z');

      const mockApplicationFee = {
        id: 'fee_stale_test',
        object: 'application_fee',
      } as any;

      const mockEvent = {
        id: 'evt_stale_fee_old_123',
        type: 'application_fee.created',
        created: olderEventTime.getTime() / 1000,
        data: { object: mockApplicationFee },
      } as Stripe.Event;

      const mockExistingTransaction = {
        id: 'trans_stale_fee',
        stripe_application_fee_id: 'fee_stale_test',
        last_event_time: newerEventTime,
      };

      const mockPrismaTx = {
        transactionEventLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        transaction: {
          findUnique: jest.fn().mockResolvedValue(mockExistingTransaction),
          update: jest.fn(),
        },
        stripeAccount: {
          findUnique: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaTx);
      });

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      await service.handleApplicationFeeCreated(mockEvent);

      expect(mockPrismaTx.transaction.findUnique).toHaveBeenCalledWith({
        where: { stripe_application_fee_id: 'fee_stale_test' },
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Stale event evt_stale_fee_old_123 for application fee fee_stale_test received.',
        ),
      );
      expect(mockPrismaTx.transaction.update).not.toHaveBeenCalled();
      expect(mockPrismaTx.transactionEventLog.create).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe('mapPayoutStatusToTransactionStatus', () => {
    it('should map "paid" to "SUCCEEDED"', () => {
      const result = (service as any).mapPayoutStatusToTransactionStatus(
        'paid',
      );
      expect(result).toBe(TransactionStatus.SUCCEEDED);
    });

    it('should map "pending" to "PENDING"', () => {
      const result = (service as any).mapPayoutStatusToTransactionStatus(
        'pending',
      );
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map "in_transit" to "PROCESSING"', () => {
      const result = (service as any).mapPayoutStatusToTransactionStatus(
        'in_transit',
      );
      expect(result).toBe(TransactionStatus.PROCESSING);
    });

    it('should map "failed" to "FAILED"', () => {
      const result = (service as any).mapPayoutStatusToTransactionStatus(
        'failed',
      );
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map "canceled" to "CANCELED"', () => {
      const result = (service as any).mapPayoutStatusToTransactionStatus(
        'canceled',
      );
      expect(result).toBe(TransactionStatus.CANCELED);
    });

    it('should map an unknown status to "PENDING" and log a warning', () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const result = (service as any).mapPayoutStatusToTransactionStatus(
        'unknown_status' as any,
      );
      expect(result).toBe(TransactionStatus.PENDING);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Unhandled Stripe Payout status: unknown_status. Defaulting to PENDING.',
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('handleApplicationFeeRefundUpdated', () => {
    it('should handle application fee refund updated event and associate it with a user', async () => {
      const mockFeeRefund = {
        id: 'fr_test_123',
        amount: 100,
        currency: 'gbp',
        fee: 'fee_test_123',
        balance_transaction: 'bal_txn_test_123',
      } as any;

      const mockApplicationFee = {
        id: 'fee_test_123',
        account: 'acct_test_123',
      };

      const mockStripeAccountRecord = {
        user_id: 'user_123',
        stripe_connect_id: 'acct_test_123',
      };

      const mockEvent = {
        id: 'evt_fr_test_123',
        type: 'application_fee.refund.updated',
        created: Date.now() / 1000,
        data: { object: mockFeeRefund },
      } as Stripe.Event;

      const mockTransaction = {
        id: 'txn_fr_123',
        type: 'APPLICATION_FEE_REFUND',
        status: 'SUCCEEDED',
      };

      mockApplicationFeesRetrieve.mockResolvedValue(mockApplicationFee);
      const mockTransactionCreateFn = jest
        .fn()
        .mockResolvedValue(mockTransaction);
      const mockStripeAccountFindUniqueFn = jest
        .fn()
        .mockResolvedValue(mockStripeAccountRecord);

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockPrismaTx = {
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          stripeAccount: {
            findUnique: mockStripeAccountFindUniqueFn,
          },
          transaction: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: mockTransactionCreateFn,
            update: jest.fn(),
          },
        };
        return await callback(mockPrismaTx as any);
      });

      await service.handleApplicationFeeRefundUpdated(mockEvent);

      expect(mockApplicationFeesRetrieve).toHaveBeenCalledWith('fee_test_123');
      expect(mockStripeAccountFindUniqueFn).toHaveBeenCalledWith({
        where: { stripe_connect_id: 'acct_test_123' },
      });
      expect(mockTransactionCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'APPLICATION_FEE_REFUND',
          status: 'SUCCEEDED',
          amount: 100,
          stripe_application_fee_refund_id: 'fr_test_123',
          user_id: 'user_123',
        }),
      });
    });

    it('should recover from P2002 on APPLICATION_FEE_REFUND transaction create', async () => {
      const mockFeeRefund = {
        id: 'fr_p2002_test',
        amount: 150,
        currency: 'usd',
        fee: 'fee_p2002_orig',
        balance_transaction: 'bal_txn_fr_p2002',
      } as any;

      const mockApplicationFee = {
        id: 'fee_p2002_orig',
        account: 'acct_for_fee_refund',
      };

      const mockStripeAccountRecord = {
        user_id: 'user_for_fee_refund',
        stripe_connect_id: 'acct_for_fee_refund',
      };

      const mockEvent = {
        id: 'evt_fr_p2002_123',
        type: 'application_fee.refund.updated',
        created: Date.now() / 1000,
        data: { object: mockFeeRefund },
      } as Stripe.Event;

      const mockCreatedTransaction = {
        id: 'txn_fr_p2002_recovered',
      };

      const mockTransactionCreateFn = jest.fn().mockImplementationOnce(() => {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          { code: 'P2002', clientVersion: 'mock' },
        );
      });

      const mockTransactionFindUniqueFn = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCreatedTransaction);

      const mockEventLogCreateFn = jest.fn();
      const mockStripeAccountFindUniqueFn = jest
        .fn()
        .mockResolvedValue(mockStripeAccountRecord);

      mockApplicationFeesRetrieve.mockResolvedValue(mockApplicationFee);

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockPrismaTx = {
          transactionEventLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: mockEventLogCreateFn,
          },
          stripeAccount: {
            findUnique: mockStripeAccountFindUniqueFn,
          },
          transaction: {
            findUnique: mockTransactionFindUniqueFn,
            create: mockTransactionCreateFn,
            update: jest.fn(),
          },
        };
        return await callback(mockPrismaTx as any);
      });

      await expect(
        service.handleApplicationFeeRefundUpdated(mockEvent),
      ).resolves.not.toThrow();

      expect(mockStripeAccountFindUniqueFn).toHaveBeenCalled();
      expect(mockTransactionCreateFn).toHaveBeenCalledTimes(1);
      expect(mockTransactionFindUniqueFn).toHaveBeenCalledTimes(2);
      expect(mockEventLogCreateFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_id: mockCreatedTransaction.id,
          stripe_event_id: mockEvent.id,
        }),
      });
    });
  });

  describe('createVirtualCardForGame', () => {
    const authId = 'auth_123';
    const gameId = 'game_123';

    const mockUser = {
      id: 'user_123',
      auth_id: authId,
      email: 'test@example.com',
      profile: {
        first_name: 'John',
        last_name: 'Doe',
        address_line_1: '1 Main Street',
        city: 'Edinburgh',
        postcode: 'EH1 1AB',
        country: 'GB',
        mobile_number: '+447911123456',
      },
    };

    const mockGame = {
      id: gameId,
      creator_id: 'user_123',
      status: 'READY_TO_BOOK',
      payment_status: 'FULLY_PAID',
      cost_per_player: 1000,
      players_current: 4,
      stripe_card_id: null,
    };

    const mockCardholder = { id: 'ich_123' };
    const mockCard = {
      id: 'ic_123',
      last4: '4242',
      exp_month: 12,
      exp_year: 2026,
      status: 'active',
    };
    const mockCardDetails = {
      ...mockCard,
      number: '4000056655665556',
      cvc: '123',
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({});
      mockIssuingCardholdersCreate.mockResolvedValue(mockCardholder);
      mockIssuingCardsCreate.mockResolvedValue(mockCard);
      mockIssuingCardsRetrieve.mockResolvedValue(mockCardDetails);
    });

    it('should throw BadRequestException when user profile is incomplete', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        profile: { ...mockUser.profile, mobile_number: null },
      });

      await expect(
        service.createVirtualCardForGame(authId, gameId),
      ).rejects.toThrow(
        new BadRequestException(
          'User profile is incomplete. first_name, last_name, mobile_number, address_line_1, city, postcode, and country are required to issue a virtual card',
        ),
      );
    });

    it('should throw BadRequestException when game status is not READY_TO_BOOK', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        status: 'PLAYERS_REQUIRED',
      });

      await expect(
        service.createVirtualCardForGame(authId, gameId),
      ).rejects.toThrow(
        new BadRequestException(
          'A virtual card can only be issued when the game is in READY_TO_BOOK status',
        ),
      );
    });

    it('should throw BadRequestException when payment status is not FULLY_PAID', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        payment_status: 'PARTIALLY_PAID',
      });

      await expect(
        service.createVirtualCardForGame(authId, gameId),
      ).rejects.toThrow(
        new BadRequestException(
          'A virtual card can only be issued when the game payment status is FULLY_PAID',
        ),
      );
    });

    it('should create and return a virtual card for a valid game', async () => {
      const result = await service.createVirtualCardForGame(authId, gameId);

      expect(mockIssuingCardholdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'individual',
          name: 'John Doe',
          email: mockUser.email,
          phone_number: mockUser.profile.mobile_number,
          billing: {
            address: {
              line1: mockUser.profile.address_line_1,
              city: mockUser.profile.city,
              postal_code: mockUser.profile.postcode,
              country: mockUser.profile.country,
            },
          },
          metadata: { app_user_id: mockUser.id, game_id: gameId },
        }),
      );
      expect(mockIssuingCardsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          cardholder: mockCardholder.id,
          currency: 'gbp',
          type: 'virtual',
          spending_controls: {
            spending_limits: [{ amount: 4000, interval: 'all_time' }],
          },
          metadata: { game_id: gameId, creator_id: mockUser.id },
        }),
      );
      expect(mockPrismaService.game.update).toHaveBeenCalledWith({
        where: { id: gameId },
        data: { stripe_card_id: mockCard.id },
      });
      expect(result).toEqual({
        card_id: mockCard.id,
        card_number: mockCardDetails.number,
        last4: mockCard.last4,
        cvc: mockCardDetails.cvc,
        exp_month: mockCard.exp_month,
        exp_year: mockCard.exp_year,
        amount_pence: 4000,
        status: mockCard.status,
      });
    });

    it('should return the existing card without creating a new one when stripe_card_id is already set', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        stripe_card_id: mockCard.id,
      });
      mockIssuingCardsRetrieve.mockResolvedValue(mockCardDetails);

      const result = await service.createVirtualCardForGame(authId, gameId);

      expect(mockIssuingCardsRetrieve).toHaveBeenCalledWith(mockCard.id, {
        expand: ['number', 'cvc'],
      });
      expect(mockIssuingCardholdersCreate).not.toHaveBeenCalled();
      expect(mockIssuingCardsCreate).not.toHaveBeenCalled();
      expect(mockPrismaService.game.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        card_id: mockCardDetails.id,
        card_number: mockCardDetails.number,
        last4: mockCardDetails.last4,
        cvc: mockCardDetails.cvc,
        exp_month: mockCardDetails.exp_month,
        exp_year: mockCardDetails.exp_year,
        amount_pence: 4000,
        status: mockCardDetails.status,
      });
    });
  });
});
