import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  NotImplementedException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { CreateConnectedAccountDto } from './dto/create-connected-account.dto';
import { CreateCustomAccountDto } from './dto/create-custom-account.dto';
import { UpdateIndividualDto } from './dto/update-individual.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentIntentMetadataDto } from './dto/create-payment-intent.dto';
import { CreateRefundDto, RefundReason } from './dto/create-refund.dto';
import {
  TransactionStatus,
  TransactionType,
  GamePlayer,
  Game,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly MAX_TRANSACTION_RETRIES = 3;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('Stripe API key not configured');
    }
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2025-04-30.basil',
    });
  }

  // Helper method to handle transaction retries
  private async executeWithRetry<T>(
    operation: (prisma: Prisma.TransactionClient) => Promise<T>,
    maxRetries: number = this.MAX_TRANSACTION_RETRIES,
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.prisma.$transaction(async (prisma) => {
          return await operation(prisma);
        });
      } catch (error) {
        lastError = error;
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          // P2034 is transaction timeout
          // P2028 is transaction conflict
          if (['P2034', 'P2028'].includes(error.code)) {
            if (attempt < maxRetries) {
              const delay = Math.min(100 * Math.pow(2, attempt), 1000); // Exponential backoff, max 1s
              console.log(
                `Transaction attempt ${attempt} failed, retrying in ${delay}ms...`,
                error,
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
          }
        }
        throw error;
      }
    }
    throw lastError || new Error('Transaction failed after retries');
  }

  // Helper method to handle Stripe API errors
  private handleStripeError(error: any, context: string): never {
    console.error(`Stripe API Error in ${context}:`, error);
    if (error instanceof Stripe.errors.StripeError) {
      switch (error.type) {
        case 'StripeCardError':
        case 'StripeInvalidRequestError':
          throw new BadRequestException(error.message);
        case 'StripeAPIError':
        case 'StripeConnectionError':
          throw new InternalServerErrorException('Stripe service unavailable');
        case 'StripeAuthenticationError':
          throw new InternalServerErrorException(
            'Stripe authentication failed',
          );
        default:
          throw new InternalServerErrorException(error.message);
      }
    }
    throw new InternalServerErrorException('An unexpected error occurred');
  }

  // Helper method to validate webhook event data
  private validateWebhookEvent(
    stripeObject: any,
    expectedObject: string,
  ): void {
    if (
      !stripeObject?.id ||
      !stripeObject?.object ||
      stripeObject.object !== expectedObject
    ) {
      throw new BadRequestException(
        `Invalid webhook event data for type ${expectedObject}`,
      );
    }
  }

  private async getUserByAuthId(authId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { stripe_account: true },
    });
    if (!user) {
      console.error(`User not found for authId: ${authId}`);
      throw new NotFoundException(`User not found for authId: ${authId}`);
    }
    return user;
  }

  private async getOrCreateStripeCustomer(
    userAuthId: string,
  ): Promise<Stripe.Customer> {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: userAuthId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with authId ${userAuthId} not found.`);
    }

    if (user.stripe_customer_id) {
      try {
        const customer = await this.stripe.customers.retrieve(
          user.stripe_customer_id,
        );
        if (customer && !customer.deleted) {
          console.log(
            `Retrieved existing Stripe Customer ${customer.id} for user ${user.id}`,
          );
          return customer as Stripe.Customer;
        }
        // If customer is deleted or not found, proceed to create a new one
        console.warn(
          `Stripe Customer ${user.stripe_customer_id} for user ${user.id} was deleted or not found. Creating a new one.`,
        );
      } catch (error) {
        // Handle cases where retrieve fails (e.g., customer truly doesn't exist)
        console.warn(
          `Failed to retrieve Stripe Customer ${user.stripe_customer_id} for user ${user.id}. Error: ${error.message}. Creating a new one.`,
        );
      }
    }

    console.log(
      `Creating new Stripe Customer for user ${user.id} (authId: ${userAuthId})`,
    );
    const customerParams: Stripe.CustomerCreateParams = {
      email: user.email, // Assuming user.email is available
      name:
        user.profile?.first_name && user.profile?.last_name
          ? `${user.profile.first_name} ${user.profile.last_name}`
          : undefined,
      metadata: {
        app_user_id: user.id,
        app_auth_id: user.auth_id,
      },
    };
    const newCustomer = await this.stripe.customers.create(customerParams);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { stripe_customer_id: newCustomer.id },
    });
    console.log(
      `Created and saved Stripe Customer ${newCustomer.id} for user ${user.id}`,
    );
    return newCustomer;
  }

  async initiateOnboardingFlow(
    authId: string,
    createConnectedAccountDto: CreateConnectedAccountDto,
  ): Promise<Stripe.AccountLink> {
    const user = await this.getUserByAuthId(authId);
    let stripeAccountId = user.stripe_account?.stripe_connect_id;
    let stripeAccountRecord = user.stripe_account;

    try {
      if (!stripeAccountId || !stripeAccountRecord) {
        console.log(
          `No Stripe account found for user ${user.id}, creating one...`,
        );
        const accountDataForCreate = {
          ...createConnectedAccountDto,
          email: user.email ?? createConnectedAccountDto.email,
        };
        const account =
          await this.internalCreateConnectedAccount(accountDataForCreate);
        stripeAccountId = account.id;
        console.log(`Created Stripe account: ${stripeAccountId}`);

        stripeAccountRecord = await this.prisma.stripeAccount.create({
          data: {
            user_id: user.id,
            stripe_connect_id: stripeAccountId,
            details_submitted: account.details_submitted ?? false,
            payouts_enabled: account.payouts_enabled ?? false,
          },
        });
        console.log(
          `Created StripeAccount record for user ${user.id} with Stripe ID ${stripeAccountId}`,
        );
      } else {
        console.log(
          `Existing Stripe account ${stripeAccountId} found for user ${user.id}. Updating details...`,
        );
      }

      const accountLink = await this.internalCreateAccountLink(stripeAccountId);
      console.log(`Created account link for ${stripeAccountId}`);
      return accountLink;
    } catch (error) {
      const idForLog = stripeAccountId || 'N/A';
      console.error(
        `Error in initiateOnboardingFlow for user ${user.id} (Stripe ID: ${idForLog}):`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to initiate Stripe onboarding flow',
        error.message,
      );
    }
  }

  // Native Connect Custom onboarding.
  //
  // Three states an account can be in when these endpoints get called:
  //   1. No StripeAccount row     -> fresh user, create Custom + persist row
  //   2. CUSTOM row, in progress  -> resume; update individual fields
  //   3. EXPRESS row              -> re-onboarding; new Custom held in
  //                                  pending_connect_id until requirements
  //                                  are met, then swap (handled in
  //                                  getAccountStatus / webhook)

  async createCustomAccount(
    authId: string,
    dto: CreateCustomAccountDto,
    tosContext: { ip: string | undefined; userAgent: string },
  ): Promise<{
    accountId: string;
    requirements: Stripe.Account.Requirements | null;
  }> {
    if (!tosContext.ip) {
      throw new BadRequestException(
        'Could not determine client IP for ToS acceptance',
      );
    }

    const user = await this.getUserByAuthId(authId);
    const existing = user.stripe_account;

    const onboardingConnectId = this.resolveOnboardingConnectId(existing);

    if (onboardingConnectId) {
      try {
        const updated = await this.stripe.accounts.update(onboardingConnectId, {
          individual: this.buildIndividualParams(dto, user.email),
        });
        return {
          accountId: updated.id,
          requirements: updated.requirements ?? null,
        };
      } catch (error) {
        this.handleStripeError(error, 'createCustomAccount.update');
      }
    }

    const account = await this.internalCreateCustomAccount(
      dto,
      user.email,
      tosContext,
    );

    if (!existing) {
      await this.prisma.stripeAccount.create({
        data: {
          user_id: user.id,
          stripe_connect_id: account.id,
          account_type: 'CUSTOM',
          details_submitted: account.details_submitted ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
        },
      });
    } else if (existing.account_type === 'EXPRESS') {
      await this.prisma.stripeAccount.update({
        where: { id: existing.id },
        data: { pending_connect_id: account.id },
      });
    } else {
      // CUSTOM row existed but had no connect id yet -- recover by setting it.
      await this.prisma.stripeAccount.update({
        where: { id: existing.id },
        data: {
          stripe_connect_id: account.id,
          details_submitted: account.details_submitted ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
        },
      });
    }

    return {
      accountId: account.id,
      requirements: account.requirements ?? null,
    };
  }

  async attachExternalAccount(
    authId: string,
    bankToken: string,
  ): Promise<{ externalAccountId: string }> {
    const user = await this.getUserByAuthId(authId);
    const connectId = this.resolveOnboardingConnectId(user.stripe_account);

    if (!connectId) {
      throw new BadRequestException(
        'No Stripe account found for user; create one first via /stripe/onboarding/account',
      );
    }

    try {
      const externalAccount = await this.stripe.accounts.createExternalAccount(
        connectId,
        {
          external_account: bankToken,
          default_for_currency: true,
        },
      );
      return { externalAccountId: externalAccount.id };
    } catch (error) {
      this.handleStripeError(error, 'attachExternalAccount');
    }
  }

  async updateIndividual(
    authId: string,
    dto: UpdateIndividualDto,
  ): Promise<{ requirements: Stripe.Account.Requirements | null }> {
    const user = await this.getUserByAuthId(authId);
    const connectId = this.resolveOnboardingConnectId(user.stripe_account);

    if (!connectId) {
      throw new NotFoundException('No Stripe account found for user');
    }

    const individual: Stripe.AccountUpdateParams.Individual = {};
    if (dto.first_name) individual.first_name = dto.first_name;
    if (dto.last_name) individual.last_name = dto.last_name;
    if (dto.phone) individual.phone = dto.phone;
    if (dto.email) individual.email = dto.email;
    if (dto.dob) individual.dob = dto.dob;
    if (dto.address) {
      individual.address = {
        line1: dto.address.line1,
        line2: dto.address.line2,
        city: dto.address.city,
        postal_code: dto.address.postal_code,
        country: 'GB',
      };
    }

    if (Object.keys(individual).length === 0) {
      throw new BadRequestException(
        'No fields supplied to update on individual',
      );
    }

    try {
      const updated = await this.stripe.accounts.update(connectId, {
        individual,
      });
      return { requirements: updated.requirements ?? null };
    } catch (error) {
      this.handleStripeError(error, 'updateIndividual');
    }
  }

  async uploadIdentityDocument(
    authId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    dto: UploadDocumentDto,
  ): Promise<{
    fileId: string;
    requirements: Stripe.Account.Requirements | null;
  }> {
    const user = await this.getUserByAuthId(authId);
    const connectId = this.resolveOnboardingConnectId(user.stripe_account);

    if (!connectId) {
      throw new NotFoundException('No Stripe account found for user');
    }

    // Upload via Stripe Files API. Use the connected account header so the
    // file is owned by the connected account (otherwise Stripe rejects
    // attaching it to individual.verification.document).
    let stripeFile: Stripe.File;
    try {
      stripeFile = await this.stripe.files.create(
        {
          file: {
            data: file.buffer,
            name: dto.file_name,
            type: file.mimetype,
          },
          purpose: 'identity_document',
        },
        { stripeAccount: connectId },
      );
    } catch (error) {
      this.handleStripeError(error, 'uploadIdentityDocument.create');
    }

    const slot = dto.slot ?? 'document';
    const individualParams: Stripe.AccountUpdateParams.Individual = {
      verification: {
        [slot]: { [dto.side]: stripeFile.id },
      },
    };

    try {
      const updated = await this.stripe.accounts.update(connectId, {
        individual: individualParams,
      });
      return {
        fileId: stripeFile.id,
        requirements: updated.requirements ?? null,
      };
    } catch (error) {
      this.handleStripeError(error, 'uploadIdentityDocument.attach');
    }
  }

  async getOnboardingRequirements(authId: string): Promise<{
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
    pending_verification: string[];
    disabled_reason: string | null;
  }> {
    const user = await this.getUserByAuthId(authId);
    const connectId = this.resolveOnboardingConnectId(user.stripe_account);

    if (!connectId) {
      throw new NotFoundException('No Stripe account found for user');
    }

    try {
      const account = await this.stripe.accounts.retrieve(connectId);
      const req = account.requirements;
      return {
        currently_due: req?.currently_due ?? [],
        eventually_due: req?.eventually_due ?? [],
        past_due: req?.past_due ?? [],
        pending_verification: req?.pending_verification ?? [],
        disabled_reason: (req?.disabled_reason as string | null) ?? null,
      };
    } catch (error) {
      this.handleStripeError(error, 'getOnboardingRequirements');
    }
  }

  // Returns the connect id we should be operating on for in-progress
  // onboarding. For Express rows mid-migration this is pending_connect_id;
  // otherwise the active stripe_connect_id; null if no account exists yet.
  private resolveOnboardingConnectId(
    record: {
      account_type: 'EXPRESS' | 'CUSTOM';
      stripe_connect_id: string;
      pending_connect_id?: string | null;
    } | null,
  ): string | null {
    if (!record) return null;
    if (record.account_type === 'EXPRESS' && record.pending_connect_id) {
      return record.pending_connect_id;
    }
    if (record.account_type === 'CUSTOM') {
      return record.stripe_connect_id;
    }
    return null;
  }

  private buildIndividualParams(
    dto: CreateCustomAccountDto,
    userEmail: string | null,
  ): Stripe.AccountUpdateParams.Individual {
    const email = dto.individual.email || userEmail || undefined;
    return {
      first_name: dto.individual.first_name,
      last_name: dto.individual.last_name,
      email,
      phone: dto.individual.phone,
      dob: dto.individual.dob,
      address: {
        line1: dto.individual.address.line1,
        line2: dto.individual.address.line2,
        city: dto.individual.address.city,
        postal_code: dto.individual.address.postal_code,
        country: 'GB',
      },
    };
  }

  private async internalCreateCustomAccount(
    dto: CreateCustomAccountDto,
    userEmail: string | null,
    tosContext: { ip: string; userAgent: string },
  ): Promise<Stripe.Account> {
    const email = dto.individual.email || userEmail || undefined;
    const params: Stripe.AccountCreateParams = {
      type: 'custom',
      country: 'GB',
      business_type: 'individual',
      business_profile: {
        product_description: 'Organizing shared golf round',
        mcc: '7999',
      },
      email,
      individual: this.buildIndividualParams(dto, userEmail),
      capabilities: {
        transfers: { requested: true },
      },
      // service_agreement omitted -> defaults to 'full'. The 'recipient' variant
      // is restricted to cross-border setups; a GB platform creating GB
      // accounts must use 'full'. Capabilities stay transfers-only since Alba
      // is the merchant of record via destination charges on the platform
      // account; connected accounts never charge cards directly.
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: tosContext.ip,
        user_agent: tosContext.userAgent,
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'manual',
          },
        },
      },
    };

    try {
      return await this.stripe.accounts.create(params);
    } catch (error) {
      this.handleStripeError(error, 'internalCreateCustomAccount');
    }
  }

  async getAccountStatus(authId: string) {
    const user = await this.getUserByAuthId(authId);
    const stripeAccountRecord = user.stripe_account;

    if (!stripeAccountRecord || !stripeAccountRecord.stripe_connect_id) {
      console.log(`No Stripe account ID found for user ${user.id}.`);
      return {
        status: 'not_started',
        accountType: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        dbStatusMatchesStripe: true,
        isReOnboarding: false,
      };
    }

    // Mid-migration (Express -> Custom): the in-progress Custom account is the
    // one we report on so the onboarding UI tracks the new account, not the
    // still-active Express one. The Express account keeps receiving payouts in
    // the background until requirements on the Custom side are met and the
    // swap below promotes Custom to active.
    const isReOnboarding =
      stripeAccountRecord.account_type === 'EXPRESS' &&
      !!stripeAccountRecord.pending_connect_id;
    const stripeAccountId = isReOnboarding
      ? (stripeAccountRecord.pending_connect_id as string)
      : stripeAccountRecord.stripe_connect_id;

    try {
      console.log(`Retrieving status for Stripe account: ${stripeAccountId}`);
      const account = await this.internalRetrieveAccount(stripeAccountId);
      console.log(`Account status retrieved for ${stripeAccountId}`);

      const currentPayoutsEnabled = account.payouts_enabled ?? false;
      const currentDetailsSubmitted = account.details_submitted ?? false;

      // Swap-when-ready: promote the pending Custom account to active once
      // Stripe has enabled payouts on it. Old Express id captured as history.
      if (isReOnboarding && currentPayoutsEnabled && currentDetailsSubmitted) {
        await this.prisma.stripeAccount.update({
          where: { id: stripeAccountRecord.id },
          data: {
            previous_connect_id: stripeAccountRecord.stripe_connect_id,
            previous_account_type: 'EXPRESS',
            stripe_connect_id: stripeAccountId,
            account_type: 'CUSTOM',
            pending_connect_id: null,
            migrated_at: new Date(),
            payouts_enabled: currentPayoutsEnabled,
            details_submitted: currentDetailsSubmitted,
          },
        });
        console.log(
          `Promoted Custom account ${stripeAccountId} for user ${user.id}; ` +
            `previous Express id ${stripeAccountRecord.stripe_connect_id} retained as history.`,
        );
        return {
          status: 'active',
          accountType: 'CUSTOM' as const,
          detailsSubmitted: true,
          chargesEnabled: account.charges_enabled ?? false,
          payoutsEnabled: true,
          dbStatusMatchesStripe: true,
          isReOnboarding: false,
        };
      }

      let dbUpdated = false;
      if (
        !isReOnboarding &&
        (stripeAccountRecord.payouts_enabled !== currentPayoutsEnabled ||
          stripeAccountRecord.details_submitted !== currentDetailsSubmitted)
      ) {
        await this.prisma.stripeAccount.update({
          where: { id: stripeAccountRecord.id },
          data: {
            payouts_enabled: currentPayoutsEnabled,
            details_submitted: currentDetailsSubmitted,
          },
        });
        console.log(
          `Updated StripeAccount for user ${user.id} in DB: payouts_enabled to ${currentPayoutsEnabled}, details_submitted to ${currentDetailsSubmitted}.`,
        );
        dbUpdated = true;
      }

      return {
        status: currentPayoutsEnabled ? 'active' : 'pending_verification',
        accountType: stripeAccountRecord.account_type,
        detailsSubmitted: currentDetailsSubmitted,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: currentPayoutsEnabled,
        dbStatusMatchesStripe: !dbUpdated,
        isReOnboarding,
      };
    } catch (error) {
      console.error(
        `Error retrieving Stripe account status for ${stripeAccountId}:`,
        error,
      );
      if (
        error?.type === 'StripeInvalidRequestError' &&
        error?.code === 'account_invalid'
      ) {
        throw new NotFoundException(
          `Stripe account ${stripeAccountId} not found or invalid.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to retrieve Stripe account status',
        error.message,
      );
    }
  }

  private async internalCreateConnectedAccount(
    createConnectedAccountDto: CreateConnectedAccountDto & { email: string },
  ): Promise<Stripe.Account> {
    const accountParams: Stripe.AccountCreateParams = {
      type: 'express',
      country: 'GB',
      business_type: 'individual',
      business_profile: {
        product_description: 'Organizing shared golf round',
        mcc: '7999',
      },
      email: createConnectedAccountDto.email,
      individual: {
        email: createConnectedAccountDto.email,
        phone: createConnectedAccountDto.individual.phone,
        address: createConnectedAccountDto.individual.address,
        dob: createConnectedAccountDto.individual.dob,
        first_name: createConnectedAccountDto.individual.first_name,
        last_name: createConnectedAccountDto.individual.last_name,
      },
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
    };

    try {
      const account = await this.stripe.accounts.create(accountParams);
      return account;
    } catch (error) {
      console.error('Stripe account creation failed:', error);
      throw new InternalServerErrorException(
        'Failed to create Stripe connected account',
        error.message,
      );
    }
  }

  private async internalCreateAccountLink(
    accountId: string,
  ): Promise<Stripe.AccountLink> {
    const refreshUrl = this.configService.get<string>('STRIPE_REFRESH_URL');
    const returnUrl = this.configService.get<string>('STRIPE_RETURN_URL');

    if (!refreshUrl || !returnUrl) {
      throw new InternalServerErrorException(
        'STRIPE_REFRESH_URL and STRIPE_RETURN_URL must be configured for Stripe Connect onboarding',
      );
    }

    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
        collect: 'eventually_due',
      });
      return accountLink;
    } catch (error) {
      console.error(`Failed to create account link for ${accountId}:`, error);
      throw new InternalServerErrorException(
        'Failed to create Stripe account link',
        error.message,
      );
    }
  }

  private async internalRetrieveAccount(
    accountId: string,
  ): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return account;
    } catch (error) {
      console.error(`Failed to retrieve Stripe account ${accountId}:`, error);
      throw error;
    }
  }

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    secretType: 'connect' | 'platform',
  ): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      `STRIPE_WEBHOOK_${secretType.toUpperCase()}_SECRET`,
    );
    if (!webhookSecret) {
      throw new InternalServerErrorException(
        `Stripe webhook secret for ${secretType} not configured`,
      );
    }
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error('Error constructing Stripe webhook event:', err.message);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }
  }

  async handleAccountUpdateWebhook(event: Stripe.Event): Promise<void> {
    // Ensure it's an account event (type guard)
    if (event.type !== 'account.updated') {
      console.warn(
        `handleAccountUpdateWebhook called with incorrect event type: ${event.type}`,
      );
      return;
    }

    const account = event.data.object as Stripe.Account;
    // Use event.created for the timestamp
    const eventCreatedTime = new Date(event.created * 1000); // Use the event's creation time

    console.log(
      `Webhook received for account ${account.id}. Event ID: ${event.id}. Event time: ${eventCreatedTime.toISOString()}. Checking status...`,
    );

    // Look up by stripe_connect_id (active) OR pending_connect_id (in-progress
    // Express -> Custom re-onboarding). Without the second clause, events for
    // a pending Custom account would be dropped on the floor as "unknown".
    const stripeAccountRecord = await this.prisma.stripeAccount.findFirst({
      where: {
        OR: [
          { stripe_connect_id: account.id },
          { pending_connect_id: account.id },
        ],
      },
      include: { user: true },
    });

    if (!stripeAccountRecord) {
      console.warn(
        `Webhook (Event ${event.id}): Received for unknown Stripe account ID: ${account.id}. No matching StripeAccount record.`,
      );
      return;
    }

    // --- Check if event is stale using event.created ---
    if (
      stripeAccountRecord.last_event_time &&
      eventCreatedTime <= stripeAccountRecord.last_event_time
    ) {
      console.log(
        `Webhook (Event ${event.id}): Skipping stale event for account ${account.id}. Event time ${eventCreatedTime.toISOString()} <= Last processed time ${stripeAccountRecord.last_event_time.toISOString()}`,
      );
      return; // Don't process older or duplicate events
    }
    // --- End Check ---

    const newPayoutsEnabled = account.payouts_enabled ?? false;
    const newDetailsSubmitted = account.details_submitted ?? false;

    // Event for the pending Custom account during Express -> Custom
    // re-onboarding. If Stripe has now enabled payouts on it, promote it to
    // active; otherwise just touch last_event_time so future events don't
    // race past it.
    const isEventForPending =
      stripeAccountRecord.pending_connect_id === account.id &&
      stripeAccountRecord.stripe_connect_id !== account.id;

    if (isEventForPending) {
      if (newPayoutsEnabled && newDetailsSubmitted) {
        await this.prisma.stripeAccount.update({
          where: { id: stripeAccountRecord.id },
          data: {
            previous_connect_id: stripeAccountRecord.stripe_connect_id,
            previous_account_type: 'EXPRESS',
            stripe_connect_id: account.id,
            account_type: 'CUSTOM',
            pending_connect_id: null,
            migrated_at: new Date(),
            payouts_enabled: true,
            details_submitted: true,
            last_event_time: eventCreatedTime,
          },
        });
        console.log(
          `Webhook (Event ${event.id}): Promoted pending Custom account ${account.id} ` +
            `for user ${stripeAccountRecord.user.id}; old Express id ` +
            `${stripeAccountRecord.stripe_connect_id} retained as history.`,
        );
        try {
          const verifiedNotification =
            this.notificationsService.createAccountVerifiedNotification();
          await this.notificationsService.sendNotificationToUser(
            stripeAccountRecord.user_id,
            verifiedNotification,
          );
        } catch (error) {
          console.error(
            `Webhook (Event ${event.id}): Failed to send verified notification:`,
            error,
          );
        }
      } else {
        await this.prisma.stripeAccount.update({
          where: { id: stripeAccountRecord.id },
          data: { last_event_time: eventCreatedTime },
        });
        console.log(
          `Webhook (Event ${event.id}): Pending account ${account.id} not yet ` +
            `ready (payouts_enabled=${newPayoutsEnabled}, details_submitted=${newDetailsSubmitted}). Recorded event time.`,
        );
      }
      return;
    }

    // Update status, details_submitted and last event time together
    if (
      stripeAccountRecord.payouts_enabled !== newPayoutsEnabled ||
      stripeAccountRecord.details_submitted !== newDetailsSubmitted ||
      !stripeAccountRecord.last_event_time ||
      eventCreatedTime > stripeAccountRecord.last_event_time
    ) {
      const justSubmittedDetails =
        !stripeAccountRecord.details_submitted && newDetailsSubmitted;
      const justEnabledPayouts =
        !stripeAccountRecord.payouts_enabled && newPayoutsEnabled;

      const updateData: Prisma.StripeAccountUpdateInput = {
        payouts_enabled: newPayoutsEnabled,
        details_submitted: newDetailsSubmitted,
        last_event_time: eventCreatedTime,
      };
      if (justSubmittedDetails && !stripeAccountRecord.details_submitted_at) {
        updateData.details_submitted_at = eventCreatedTime;
      }
      if (justEnabledPayouts) {
        // Reset so a future regression can re-alert.
        updateData.issue_notified_at = null;
      }

      await this.prisma.stripeAccount.update({
        where: { id: stripeAccountRecord.id },
        data: updateData,
      });
      console.log(
        `Webhook (Event ${event.id}): Updated StripeAccount for user ${stripeAccountRecord.user.id}: payouts_enabled to ${newPayoutsEnabled}, details_submitted to ${newDetailsSubmitted}, and last_event_time to ${eventCreatedTime.toISOString()}`,
      );

      // NOTIFICATION: Notify user of account status changes
      try {
        if (justEnabledPayouts) {
          // Account just became verified - send success notification
          const verifiedNotification =
            this.notificationsService.createAccountVerifiedNotification();
          await this.notificationsService.sendNotificationToUser(
            stripeAccountRecord.user_id,
            verifiedNotification,
          );
          console.log(
            `Sent account verified notification to user ${stripeAccountRecord.user_id}`,
          );
        } else if (
          !newPayoutsEnabled &&
          newDetailsSubmitted &&
          !stripeAccountRecord.issue_notified_at
        ) {
          // Two gates before alerting, so we don't cry wolf during the normal
          // post-onboarding review window:
          //  1. Stripe surfaces a real blocker (not just "pending review").
          //  2. Submission happened long enough ago that "still under review"
          //     is no longer the most likely explanation.
          const requirements = account.requirements;
          const NORMAL_REVIEW_REASONS = new Set([
            'requirements.pending_verification',
            'under_review',
          ]);
          const hasRealBlocker =
            (requirements?.past_due?.length ?? 0) > 0 ||
            (requirements?.currently_due?.length ?? 0) > 0 ||
            (!!requirements?.disabled_reason &&
              !NORMAL_REVIEW_REASONS.has(requirements.disabled_reason));

          const submittedAt =
            stripeAccountRecord.details_submitted_at ??
            (justSubmittedDetails ? eventCreatedTime : null);
          const ISSUE_NOTIFICATION_DELAY_MS = 24 * 60 * 60 * 1000;
          const delayElapsed =
            !!submittedAt &&
            Date.now() - submittedAt.getTime() >= ISSUE_NOTIFICATION_DELAY_MS;

          if (hasRealBlocker && delayElapsed) {
            const issueNotification =
              this.notificationsService.createAccountIssueNotification(
                'Your account details are under review',
              );
            await this.notificationsService.sendNotificationToUser(
              stripeAccountRecord.user_id,
              issueNotification,
            );
            await this.prisma.stripeAccount.update({
              where: { id: stripeAccountRecord.id },
              data: { issue_notified_at: new Date() },
            });
            console.log(
              `Sent account issue notification to user ${stripeAccountRecord.user_id}`,
            );
          } else {
            console.log(
              `Webhook (Event ${event.id}): Skipping issue notification for user ${stripeAccountRecord.user_id} (hasRealBlocker=${hasRealBlocker}, delayElapsed=${delayElapsed})`,
            );
          }
        }
      } catch (error) {
        // Don't fail the webhook for notification errors
        console.error(
          `Failed to send account status notification to user ${stripeAccountRecord.user_id}:`,
          error,
        );
      }
    } else {
      console.log(
        `Webhook (Event ${event.id}): DB status for StripeAccount (user ${stripeAccountRecord.user.id}) already matches Stripe status (payouts: ${newPayoutsEnabled}, details: ${newDetailsSubmitted}) and event is not newer. No update needed.`,
      );
    }
  }

  private async internalUpdateConnectedAccount(
    accountId: string,
    data: Stripe.AccountUpdateParams,
  ): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.update(accountId, data);
      console.log(`Successfully updated Stripe account ${accountId}`);
      return account;
    } catch (error) {
      console.error(`Stripe account update failed for ${accountId}:`, error);
      if (error instanceof Stripe.errors.StripeError) {
        throw new InternalServerErrorException(
          `Stripe Error updating account: ${error.message}`,
          error.code,
        );
      }
      throw new InternalServerErrorException(
        'Failed to update Stripe connected account',
        error.message,
      );
    }
  }

  async createManualPayout(
    initiatorAuthId: string, // auth_id of the platform user/admin initiating this payout
    payoutDetails: {
      amount: number; // Amount in the smallest currency unit (e.g., cents, pence)
      currency: string; // e.g., 'gbp', 'usd'
      connectedAccountId: string; // The Stripe Connect account ID from whose balance the payout is made
      description?: string; // Optional: A description for the payout
      metadata?: Record<string, string>; // Optional: Metadata for the payout
    },
  ): Promise<Stripe.Payout> {
    // Verify the platform user initiating the payout exists (for auditing/logging)
    const platformUser = await this.getUserByAuthId(initiatorAuthId);
    if (!platformUser) {
      // This case should ideally be caught by getUserByAuthId throwing NotFoundException
      throw new NotFoundException(
        `Platform user with authId ${initiatorAuthId} not found. Cannot initiate payout.`,
      );
    }

    console.log(
      `Attempting to create payout from Stripe account ${payoutDetails.connectedAccountId} by platform user ${platformUser.id} (authId ${initiatorAuthId}). Amount: ${payoutDetails.amount} ${payoutDetails.currency}`,
    );

    try {
      const payout = await this.stripe.payouts.create(
        {
          amount: payoutDetails.amount,
          currency: payoutDetails.currency,
          description: payoutDetails.description, // Add description if provided
          metadata: payoutDetails.metadata, // Add metadata if provided
          // destination: 'ba_xyz...' // Optionally specify a specific bank account/card ID
          // If omitted, Stripe uses the account's default external account for the currency
        },
        {
          stripeAccount: payoutDetails.connectedAccountId, // This makes the API call on behalf of the connected account
        },
      );

      console.log(
        `Successfully created payout ${payout.id} from ${payoutDetails.connectedAccountId}. Status: ${payout.status}`,
      );
      // Optionally, record this payout event in your database
      return payout;
    } catch (error) {
      console.error(
        `Failed to create payout from ${payoutDetails.connectedAccountId}:`,
        error,
      );
      if (error instanceof Stripe.errors.StripeError) {
        throw new InternalServerErrorException(
          `Stripe Error creating payout: ${error.message}`,
          error.code,
        );
      }
      throw new InternalServerErrorException(
        'Failed to create payout',
        error.message,
      );
    }
  }

  async createPaymentIntent(
    payerAuthId: string, // The authId of the user making the payment
    paymentIntentDto: {
      amount: number;
      currency: string;
      recipientAuthId: string; // The auth_id of the user who will eventually receive the funds
      applicationFeeAmount?: number;
      metadata?: PaymentIntentMetadataDto;
    },
  ): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    recipientStripeAccountId: string | null;
    ephemeralKey: string;
    customerId: string;
    publishableKey: string;
  }> {
    const publishableKey = this.configService.get<string>(
      'STRIPE_PUBLISHABLE_KEY',
    );
    if (!publishableKey) {
      throw new InternalServerErrorException(
        'Stripe publishable key not configured',
      );
    }
    // Get or create Stripe Customer for the payer
    const payerStripeCustomer =
      await this.getOrCreateStripeCustomer(payerAuthId);

    const recipientUser = await this.prisma.user.findUnique({
      where: { auth_id: paymentIntentDto.recipientAuthId },
      include: { stripe_account: true },
    });

    if (!recipientUser) {
      throw new NotFoundException(
        `Recipient user with authId ${paymentIntentDto.recipientAuthId} not found.`,
      );
    }

    if (!recipientUser.stripe_account?.stripe_connect_id) {
      console.error(
        `Recipient user ${recipientUser.id} (authId: ${paymentIntentDto.recipientAuthId}) does not have a Stripe Connect account ID. Payment cannot proceed.`,
      );
      // Depending on your flow, you might want to throw an error or handle this differently
      throw new InternalServerErrorException(
        `Recipient ${recipientUser.id} is not set up to receive payments. Missing Stripe Connect ID.`,
      );
    }

    const recipientStripeAccountId =
      recipientUser.stripe_account.stripe_connect_id;

    // Create an Ephemeral Key for the PaymentSheet
    const ephemeralKey = await this.stripe.ephemeralKeys.create(
      {
        customer: payerStripeCustomer.id,
      },
      {
        apiVersion: '2025-04-30.basil',
      },
    );

    try {
      // Application fee is now passed directly from the DTO
      const feeAmountFromDto = paymentIntentDto.applicationFeeAmount;

      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: paymentIntentDto.amount, // This is the total amount charged to the customer
        currency: paymentIntentDto.currency,
        customer: payerStripeCustomer.id,
        setup_future_usage: 'on_session',
        automatic_payment_methods: { enabled: true },
        // Use the application_fee_amount from the DTO if it's a positive number
        application_fee_amount:
          feeAmountFromDto && feeAmountFromDto > 0
            ? feeAmountFromDto
            : undefined,
        transfer_data: {
          destination: recipientStripeAccountId,
        },
        metadata: {
          payer_auth_id: payerAuthId,
          payer_user_id: payerStripeCustomer.metadata.app_user_id,
          recipient_auth_id: paymentIntentDto.recipientAuthId,
          recipient_user_id: recipientUser.id,
          recipient_stripe_account_id: recipientStripeAccountId,
          payer_stripe_customer_id: payerStripeCustomer.id, // Add payer customer ID to metadata
          ...(paymentIntentDto.metadata || {}),
        },
      };

      console.log(
        `Creating PaymentIntent for payer ${payerStripeCustomer.metadata.app_user_id} to eventually pay recipient ${recipientUser.id} (Stripe Acc: ${recipientStripeAccountId}). Amount: ${paymentIntentDto.amount} ${paymentIntentDto.currency}`,
      );

      const paymentIntent =
        await this.stripe.paymentIntents.create(paymentIntentParams);

      console.log(
        `PaymentIntent ${paymentIntent.id} created successfully. Client secret will be returned.`,
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        recipientStripeAccountId: recipientStripeAccountId, // Return this for reference if needed
        ephemeralKey: ephemeralKey.secret,
        customerId: payerStripeCustomer.id,
        publishableKey,
      };
    } catch (error) {
      console.error(
        `Failed to create PaymentIntent for payer ${payerAuthId} to recipient ${paymentIntentDto.recipientAuthId}:`,
        error,
      );
      if (error instanceof Stripe.errors.StripeError) {
        throw new InternalServerErrorException(
          `Stripe Error creating PaymentIntent: ${error.message}`,
          error.code,
        );
      }
      throw new InternalServerErrorException(
        'Failed to create PaymentIntent',
        error.message,
      );
    }
  }

  async createPlatformPaymentIntent(
    payerAuthId: string,
    gamePlayerId: string,
    params: {
      amount: number;
      currency: string;
      metadata?: PaymentIntentMetadataDto;
    },
  ): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    ephemeralKey: string;
    customerId: string;
    publishableKey: string;
  }> {
    const publishableKey = this.configService.get<string>(
      'STRIPE_PUBLISHABLE_KEY',
    );
    if (!publishableKey) {
      throw new InternalServerErrorException(
        'Stripe publishable key not configured',
      );
    }

    const payerStripeCustomer =
      await this.getOrCreateStripeCustomer(payerAuthId);

    const ephemeralKey = await this.stripe.ephemeralKeys.create(
      { customer: payerStripeCustomer.id },
      { apiVersion: '2025-04-30.basil' },
    );

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency,
        customer: payerStripeCustomer.id,
        setup_future_usage: 'on_session',
        automatic_payment_methods: { enabled: true },
        metadata: {
          payer_auth_id: payerAuthId,
          payer_user_id: payerStripeCustomer.metadata.app_user_id,
          game_player_id: gamePlayerId,
          ...(params.metadata || {}),
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        ephemeralKey: ephemeralKey.secret,
        customerId: payerStripeCustomer.id,
        publishableKey,
      };
    } catch (error) {
      this.handleStripeError(error, 'createPlatformPaymentIntent');
    }
  }

  async createRefund(
    initiatorAuthId: string, // For logging/auditing who initiated the refund
    refundDto: CreateRefundDto,
  ): Promise<Stripe.Refund> {
    const platformUser = await this.getUserByAuthId(initiatorAuthId);
    if (!platformUser) {
      throw new NotFoundException(
        `Platform user with authId ${initiatorAuthId} not found. Cannot initiate refund.`,
      );
    }

    console.log(
      `Attempting to refund PaymentIntent ${refundDto.paymentIntentId} by platform user ${platformUser.id} (authId ${initiatorAuthId}). Amount: ${refundDto.amount ?? 'full'}, Reason: ${refundDto.reason ?? 'N/A'}`,
    );

    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: refundDto.paymentIntentId,
      };

      if (refundDto.amount) {
        refundParams.amount = refundDto.amount;
      }

      if (refundDto.reason) {
        refundParams.reason = refundDto.reason;
      }

      // Default to true if not specified in DTO, allowing override
      refundParams.reverse_transfer =
        refundDto.reverseTransfer !== undefined
          ? refundDto.reverseTransfer
          : true;
      refundParams.refund_application_fee =
        refundDto.refundApplicationFee !== undefined
          ? refundDto.refundApplicationFee
          : false;

      // You can add more specific metadata to the refund itself if needed
      // refundParams.metadata = { initiated_by_user_id: platformUser.id };

      const refund = await this.stripe.refunds.create(refundParams);

      console.log(
        `Successfully created refund ${refund.id} for PaymentIntent ${refundDto.paymentIntentId}. Status: ${refund.status}`,
      );

      return refund;
    } catch (error) {
      console.error(
        `Failed to create refund for PaymentIntent ${refundDto.paymentIntentId}:`,
        error,
      );
      if (error instanceof Stripe.errors.StripeError) {
        throw new InternalServerErrorException(
          `Stripe Error creating refund: ${error.message}`,
          error.code,
        );
      }
      throw new InternalServerErrorException(
        'Failed to create refund',
        error.message,
      );
    }
  }

  // Method to handle successful payment intents from webhooks
  async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);

    this.validateWebhookEvent(paymentIntent, 'payment_intent');

    try {
      await this.executeWithRetry(async (prisma) => {
        // 1. Idempotency Check
        const existingEventLog = await prisma.transactionEventLog.findUnique({
          where: { stripe_event_id: stripeEventId },
        });
        if (existingEventLog) {
          console.log(
            `Event ${stripeEventId} (PI: ${paymentIntent.id}) already processed. Skipping.`,
          );
          return;
        }

        // 2. Find or Create Parent Transaction
        let parentChargeTransaction = await prisma.transaction.findFirst({
          where: {
            stripe_payment_intent_id: paymentIntent.id,
            type: TransactionType.PAYMENT_INTENT_CHARGE,
          },
        });

        // Staleness Check
        if (
          parentChargeTransaction?.last_event_time &&
          stripeEventCreatedAt <= parentChargeTransaction.last_event_time
        ) {
          console.log(
            `Stale event ${stripeEventId} for PI ${paymentIntent.id} received. Skipping.`,
          );
          return;
        }

        const chargeId =
          typeof paymentIntent.latest_charge === 'string'
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id;
        const payerUserId =
          (paymentIntent.metadata as any)?.payer_user_id || null;
        const gameId = (paymentIntent.metadata as any)?.game_id || null;
        const gamePlayerId =
          (paymentIntent.metadata as any)?.game_player_id || null;
        const customerId =
          typeof paymentIntent.customer === 'string'
            ? paymentIntent.customer
            : paymentIntent.customer?.id;
        const connectedAccountId =
          typeof paymentIntent.transfer_data?.destination === 'string'
            ? paymentIntent.transfer_data.destination
            : paymentIntent.transfer_data?.destination?.id;

        if (!parentChargeTransaction) {
          try {
            parentChargeTransaction = await prisma.transaction.create({
              data: {
                type: TransactionType.PAYMENT_INTENT_CHARGE,
                status: TransactionStatus.SUCCEEDED,
                amount: paymentIntent.amount_received,
                currency: paymentIntent.currency,
                description: `Charge for PI: ${paymentIntent.id}`,
                user_id: payerUserId,
                game_id: gameId,
                game_player_id: gamePlayerId,
                stripe_payment_intent_id: paymentIntent.id,
                stripe_charge_id: chargeId,
                stripe_customer_id: customerId,
                stripe_connected_account_id: connectedAccountId,
                processed_at: new Date(),
                metadata: paymentIntent.metadata,
                last_event_time: stripeEventCreatedAt,
              },
            });
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              parentChargeTransaction = await prisma.transaction.findFirst({
                where: {
                  stripe_payment_intent_id: paymentIntent.id,
                  type: TransactionType.PAYMENT_INTENT_CHARGE,
                },
              });
              if (!parentChargeTransaction) {
                throw new Error(
                  `Failed to handle race condition for PI ${paymentIntent.id}`,
                );
              }
            } else {
              throw e;
            }
          }
        } else {
          parentChargeTransaction = await prisma.transaction.update({
            where: { id: parentChargeTransaction.id },
            data: {
              status: TransactionStatus.SUCCEEDED,
              amount: paymentIntent.amount_received,
              stripe_charge_id: chargeId,
              stripe_customer_id: customerId,
              stripe_connected_account_id: connectedAccountId,
              processed_at: new Date(),
              metadata: paymentIntent.metadata,
              last_event_time: stripeEventCreatedAt,
            },
          });
        }

        // 3. Create TransactionEventLog
        await prisma.transactionEventLog.create({
          data: {
            transaction_id: parentChargeTransaction.id,
            stripe_event_id: stripeEventId,
            stripe_event_type: 'payment_intent.succeeded',
            status: TransactionStatus.SUCCEEDED,
            details: JSON.parse(JSON.stringify(paymentIntent)),
            stripe_event_created_at: stripeEventCreatedAt,
          },
        });

        // 4. Update GamePlayer / Game Status
        if (gamePlayerId && gameId) {
          console.log(`Updating game player ${gamePlayerId} and game ${gameId} status`);
          const gamePlayer = await prisma.gamePlayer.findUnique({
            where: { id: gamePlayerId },
          });

          if (gamePlayer && !gamePlayer.has_paid) {
            console.log(`Marking game player ${gamePlayerId} as paid with amount ${paymentIntent.amount_received}`);
            await prisma.gamePlayer.update({
              where: { id: gamePlayerId },
              data: {
                has_paid: true,
                payment_amount: paymentIntent.amount_received,
                payment_date: new Date(),
                stripe_payment_id: paymentIntent.id,
              },
            });

            const game = await prisma.game.findUnique({
              where: { id: gameId },
              include: { players: { where: { deleted_at: null } } },
            });

            if (game) {
              const allPlayersPaid = game.players.every(
                (p) => p.has_paid || p.id === gamePlayerId,
              );
              const somePlayersPaid = game.players.some(
                (p) => p.has_paid || p.id === gamePlayerId,
              );
              let paymentStatus = game.payment_status;
              if (allPlayersPaid) paymentStatus = 'FULLY_PAID';
              else if (somePlayersPaid) paymentStatus = 'PARTIALLY_PAID';

              if (paymentStatus !== game.payment_status) {
                await prisma.game.update({
                  where: { id: gameId },
                  data: { payment_status: paymentStatus },
                });

                // If the game just became fully paid, notify the organiser
                if (paymentStatus === 'FULLY_PAID') {
                  try {
                    // Format date as DD/MM/YYYY for the organiser notification
                    let gameDateFormatted: string | undefined = undefined;
                    if (game.date) {
                      const d = new Date(game.date);
                      const dd = String(d.getDate()).padStart(2, '0');
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const yyyy = d.getFullYear();
                      gameDateFormatted = `${dd}/${mm}/${yyyy}`;
                    }

                    const allPaidNotification =
                      this.notificationsService.createAllPlayersPaidNotification(
                        gameId,
                        gameDateFormatted,
                      );
                    await this.notificationsService.sendNotificationToUser(
                      game.creator_id,
                      allPaidNotification,
                    );
                    console.log(
                      `Sent all players paid notification to organiser ${game.creator_id} for game ${gameId}`,
                    );
                  } catch (notifyErr) {
                    console.error(
                      `Failed to send all players paid notification for game ${gameId}:`,
                      notifyErr,
                    );
                  }
                }
              }
            }
          }
        }

        // NOTIFICATION: Notify organiser that a player has paid
        try {
          const recipientUserId =
            (paymentIntent.metadata as any)?.recipient_user_id || null;

          if (recipientUserId && payerUserId) {
            let payerDisplayName = 'A player';
            const payer = await prisma.user.findUnique({
              where: { id: payerUserId },
              include: { profile: true },
            });

            if (payer?.profile?.first_name && payer?.profile?.last_name) {
              payerDisplayName = `${payer.profile.first_name} ${payer.profile.last_name}`;
            } else if (payer?.profile?.first_name) {
              payerDisplayName = payer.profile.first_name;
            }

            // Fetch game date to format as DD/MM/YYYY
            let gameDateFormatted: string | undefined = undefined;
            if (gameId) {
              const theGame = await prisma.game.findUnique({
                where: { id: gameId },
                select: { date: true },
              });
              if (theGame?.date) {
                const d = new Date(theGame.date);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                gameDateFormatted = `${dd}/${mm}/${yyyy}`;
              }
            }

            const organiserNotification =
              this.notificationsService.createPaymentReceivedNotification(
                payerDisplayName,
                gameDateFormatted,
                gameId,
              );

            await this.notificationsService.sendNotificationToUser(
              recipientUserId,
              organiserNotification,
            );
            console.log(
              `Sent organiser payment received notification to user ${recipientUserId} for PI ${paymentIntent.id}`,
            );
          }
        } catch (notifError) {
          // Do not fail webhook if notification sending fails
          console.error(
            `Failed to send organiser payment received notification for PI ${paymentIntent.id}:`,
            notifError,
          );
        }
      });
    } catch (error) {
      console.error('Error in handlePaymentIntentSucceeded:', {
        paymentIntentId: paymentIntent.id,
        eventId: stripeEventId,
        error,
      });
      throw error;
    }
  }

  // Method to handle refund updates from webhooks
  async handleRefundUpdated(event: Stripe.Event): Promise<void> {
    const refund = event.data.object as Stripe.Refund;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);

    this.validateWebhookEvent(refund, 'refund');

    try {
      await this.executeWithRetry(async (prisma) => {
        // 1. Idempotency Check (using stripe_event_id)
        const existingEventLog = await prisma.transactionEventLog.findUnique({
          where: { stripe_event_id: stripeEventId },
        });
        if (existingEventLog) {
          console.log(
            `Event ${stripeEventId} (Refund ID: ${refund.id}) already processed. Skipping.`,
          );
          return;
        }

        // 2. Find Parent Transaction for the REFUND
        let parentRefundTransaction = await prisma.transaction.findUnique({
          where: { stripe_refund_id: refund.id },
        });

        // 3. Staleness Check (using last_event_time)
        if (
          parentRefundTransaction?.last_event_time &&
          stripeEventCreatedAt <= parentRefundTransaction.last_event_time
        ) {
          console.log(
            `Stale event ${stripeEventId} for refund ${refund.id} received. Current timestamp: ${stripeEventCreatedAt.toISOString()}, last processed: ${parentRefundTransaction.last_event_time.toISOString()}. Skipping.`,
          );
          return;
        }

        // 4. Determine TransactionStatus from Stripe refund status
        let newTransactionStatus: TransactionStatus;
        switch (refund.status) {
          case 'succeeded':
            newTransactionStatus = TransactionStatus.SUCCEEDED;
            break;
          case 'failed':
            newTransactionStatus = TransactionStatus.FAILED;
            break;
          case 'pending':
            newTransactionStatus = TransactionStatus.PENDING;
            break;
          case 'requires_action':
            newTransactionStatus = TransactionStatus.REQUIRES_ACTION;
            break;
          default:
            console.warn(
              `Unhandled Stripe Refund status: ${refund.status} for refund ID: ${refund.id}. Storing as PENDING.`,
            );
            newTransactionStatus = TransactionStatus.PENDING;
        }

        // 5. Fetch Additional Info & Prepare Data
        const paymentIntentId =
          typeof refund.payment_intent === 'string'
            ? refund.payment_intent
            : null;
        const chargeId =
          typeof refund.charge === 'string' ? refund.charge : null;
        let gamePlayerId: string | null = null;
        let gameId: string | null = null;
        let userId: string | null = null;

        // Attempt to fetch original PI metadata if needed
        if (
          (!parentRefundTransaction ||
            !parentRefundTransaction.game_player_id ||
            !parentRefundTransaction.game_id ||
            !parentRefundTransaction.user_id) &&
          paymentIntentId
        ) {
          try {
            const originalPaymentIntent =
              await this.stripe.paymentIntents.retrieve(paymentIntentId);
            gamePlayerId =
              (originalPaymentIntent.metadata as any)?.game_player_id || null;
            gameId = (originalPaymentIntent.metadata as any)?.game_id || null;
            userId =
              (originalPaymentIntent.metadata as any)?.payer_user_id || null;
          } catch (piError) {
            // Log error but continue processing - we can still handle the refund without metadata
            console.error(
              `Could not retrieve original PaymentIntent ${paymentIntentId} metadata for refund ${refund.id}:`,
              piError,
            );
          }
        }

        const transactionDataForCreateOrDetails = {
          type: TransactionType.REFUND,
          status: newTransactionStatus,
          amount: refund.amount,
          currency: refund.currency,
          description: `Refund for PI: ${paymentIntentId}. Reason: ${refund.reason || 'N/A'}. Stripe Refund ID: ${refund.id}`,
          user_id: userId,
          game_id: gameId,
          game_player_id: gamePlayerId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_charge_id: chargeId,
          stripe_refund_id: refund.id,
          processed_at: new Date(),
          metadata: JSON.parse(JSON.stringify(refund)),
          last_event_time: stripeEventCreatedAt,
        };

        if (!parentRefundTransaction) {
          try {
            parentRefundTransaction = await prisma.transaction.create({
              data: transactionDataForCreateOrDetails,
            });
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              parentRefundTransaction = await prisma.transaction.findUnique({
                where: { stripe_refund_id: refund.id },
              });
              if (!parentRefundTransaction) {
                throw new Error(
                  `Failed to handle race condition for refund ${refund.id}`,
                );
              }
            } else {
              throw e;
            }
          }
        } else {
          parentRefundTransaction = await prisma.transaction.update({
            where: { id: parentRefundTransaction.id },
            data: {
              status: newTransactionStatus,
              amount: refund.amount,
              description: transactionDataForCreateOrDetails.description,
              processed_at: new Date(),
              metadata: transactionDataForCreateOrDetails.metadata,
              last_event_time: stripeEventCreatedAt,
            },
          });
        }

        // 7. Create TransactionEventLog
        await prisma.transactionEventLog.create({
          data: {
            transaction_id: parentRefundTransaction.id,
            stripe_event_id: stripeEventId,
            stripe_event_type: 'refund.updated',
            status: newTransactionStatus,
            details: JSON.parse(JSON.stringify(refund)),
            stripe_event_created_at: stripeEventCreatedAt,
          },
        });

        // 8. Update GamePlayer / Game Status if the refund is SUCCEEDED
        if (newTransactionStatus === TransactionStatus.SUCCEEDED) {
          const finalGamePlayerId = parentRefundTransaction.game_player_id;
          const finalGameId = parentRefundTransaction.game_id;

          if (finalGamePlayerId && finalGameId) {
            const gamePlayer = await prisma.gamePlayer.findUnique({
              where: { id: finalGamePlayerId },
            });

            if (gamePlayer) {
              await prisma.gamePlayer.update({
                where: { id: finalGamePlayerId },
                data: {
                  refunded: true,
                  refund_date: new Date(),
                  has_paid: false,
                },
              });

              const updatedGame = await prisma.game.findUnique({
                where: { id: finalGameId },
                include: { players: { where: { deleted_at: null } } },
              });

              if (updatedGame) {
                const allPlayersPaid = updatedGame.players.every((p) =>
                  p.id === finalGamePlayerId ? false : p.has_paid,
                );
                const somePlayersPaid = updatedGame.players.some((p) =>
                  p.id === finalGamePlayerId ? false : p.has_paid,
                );

                let newGamePaymentStatus = updatedGame.payment_status;
                if (!somePlayersPaid) {
                  newGamePaymentStatus = 'PENDING';
                } else if (allPlayersPaid) {
                  newGamePaymentStatus = 'FULLY_PAID';
                } else {
                  newGamePaymentStatus = 'PARTIALLY_PAID';
                }

                if (newGamePaymentStatus !== updatedGame.payment_status) {
                  await prisma.game.update({
                    where: { id: finalGameId },
                    data: { payment_status: newGamePaymentStatus },
                  });
                }
              }

              // NOTIFICATION: Notify user about successful refund
              try {
                const refundNotification =
                  this.notificationsService.createRefundProcessedNotification(
                    refund.amount,
                    finalGameId,
                  );
                await this.notificationsService.sendNotificationToUser(
                  gamePlayer.user_id,
                  refundNotification,
                );
                console.log(
                  `Sent refund processed notification to user ${gamePlayer.user_id} for refund ${refund.id}`,
                );
              } catch (error) {
                // Don't fail the webhook for notification errors
                console.error(
                  `Failed to send refund processed notification to user ${gamePlayer.user_id}:`,
                  error,
                );
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error in handleRefundUpdated:', {
        refundId: refund.id,
        eventId: stripeEventId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
      throw error;
    }
  }

  private mapPayoutStatusToTransactionStatus(
    payoutStatus: Stripe.Payout['status'],
  ): TransactionStatus {
    switch (payoutStatus) {
      case 'paid':
        return TransactionStatus.SUCCEEDED;
      case 'pending':
        return TransactionStatus.PENDING;
      case 'in_transit':
        return TransactionStatus.PROCESSING;
      case 'failed':
        return TransactionStatus.FAILED;
      case 'canceled':
        return TransactionStatus.CANCELED;
      default:
        console.warn(
          `Unhandled Stripe Payout status: ${payoutStatus}. Defaulting to PENDING.`,
        );
        return TransactionStatus.PENDING;
    }
  }

  async handlePayoutPaid(event: Stripe.Event): Promise<void> {
    const payout = event.data.object as Stripe.Payout;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);
    const connectedAccountId = event.account;

    if (!connectedAccountId) {
      throw new BadRequestException(
        'Missing connected account ID for payout event',
      );
    }

    this.validateWebhookEvent(payout, 'payout');

    try {
      await this.executeWithRetry(async (prisma) => {
        // 1. Idempotency Check
        const existingEventLog = await prisma.transactionEventLog.findUnique({
          where: { stripe_event_id: stripeEventId },
        });
        if (existingEventLog) {
          console.log(
            `Event ${stripeEventId} (Payout ID: ${payout.id}) already processed. Skipping.`,
          );
          return;
        }

        const transactionStatus = TransactionStatus.SUCCEEDED; // Directly from event type

        let platformUserId: string | null = null;
        const stripeAccountRecord = await prisma.stripeAccount.findUnique({
          where: { stripe_connect_id: connectedAccountId },
        });
        if (stripeAccountRecord) {
          platformUserId = stripeAccountRecord.user_id;
        } else {
          console.warn(
            `No StripeAccount record found for connectedAccountId: ${connectedAccountId} during payout.paid handling for Payout ID: ${payout.id}`,
          );
        }

        let parentPayoutTransaction = await prisma.transaction.findUnique({
          where: { stripe_payout_id: payout.id },
        });

        // 2. Staleness Check
        if (
          parentPayoutTransaction?.last_event_time &&
          stripeEventCreatedAt <= parentPayoutTransaction.last_event_time
        ) {
          console.log(
            `Stale event ${stripeEventId} for payout ${payout.id} received. Skipping.`,
          );
          return;
        }

        const description = `Payout to bank succeeded. Payout ID: ${payout.id}. Arrival: ${new Date(payout.arrival_date * 1000).toLocaleDateString()}`;

        if (!parentPayoutTransaction) {
          try {
            parentPayoutTransaction = await prisma.transaction.create({
              data: {
                type: TransactionType.PAYOUT,
                status: transactionStatus,
                amount: payout.amount,
                currency: payout.currency,
                description: description,
                user_id: platformUserId,
                stripe_payout_id: payout.id,
                stripe_connected_account_id: connectedAccountId,
                stripe_balance_transaction_id:
                  typeof payout.balance_transaction === 'string'
                    ? payout.balance_transaction
                    : null,
                processed_at: new Date(),
                metadata: JSON.parse(JSON.stringify(payout)),
                last_event_time: stripeEventCreatedAt,
              },
            });
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              parentPayoutTransaction = await prisma.transaction.findUnique({
                where: { stripe_payout_id: payout.id },
              });
              if (!parentPayoutTransaction) {
                throw new Error(
                  `Failed to handle race condition for Payout ${payout.id}`,
                );
              }
            } else {
              throw e;
            }
          }
        } else {
          parentPayoutTransaction = await prisma.transaction.update({
            where: { id: parentPayoutTransaction.id },
            data: {
              status: transactionStatus,
              amount: payout.amount,
              currency: payout.currency,
              description: description,
              user_id: platformUserId || parentPayoutTransaction.user_id, // Keep existing if new one is null
              stripe_balance_transaction_id:
                typeof payout.balance_transaction === 'string'
                  ? payout.balance_transaction
                  : parentPayoutTransaction.stripe_balance_transaction_id,
              processed_at: new Date(),
              metadata: JSON.parse(JSON.stringify(payout)),
              last_event_time: stripeEventCreatedAt,
            },
          });
        }

        await prisma.transactionEventLog.create({
          data: {
            transaction_id: parentPayoutTransaction.id,
            stripe_event_id: stripeEventId,
            stripe_event_type: 'payout.paid',
            status: transactionStatus,
            details: JSON.parse(JSON.stringify(payout)),
            stripe_event_created_at: stripeEventCreatedAt,
          },
        });

        // NOTIFICATION: Notify user about successful payout
        if (platformUserId) {
          try {
            const gameMetadata = payout.metadata as any;
            const gameId = gameMetadata?.game_id || null;
            const payoutNotification =
              this.notificationsService.createPayoutSuccessNotification(
                payout.amount,
                gameId,
              );
            await this.notificationsService.sendNotificationToUser(
              platformUserId,
              payoutNotification,
            );
            console.log(
              `Sent payout success notification to user ${platformUserId} for payout ${payout.id}`,
            );
          } catch (error) {
            // Don't fail the webhook for notification errors
            console.error(
              `Failed to send payout success notification to user ${platformUserId}:`,
              error,
            );
          }
        }
      });
    } catch (error) {
      console.error('Error in handlePayoutPaid:', {
        payoutId: payout.id,
        eventId: stripeEventId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
      throw error;
    }
  }

  async handlePayoutFailed(event: Stripe.Event): Promise<void> {
    const payout = event.data.object as Stripe.Payout;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);
    const connectedAccountId = event.account;

    if (!connectedAccountId) {
      throw new BadRequestException(
        'Missing connected account ID for payout event',
      );
    }

    this.validateWebhookEvent(payout, 'payout');

    try {
      await this.executeWithRetry(async (prisma) => {
        // 1. Idempotency Check
        const existingEventLog = await prisma.transactionEventLog.findUnique({
          where: { stripe_event_id: stripeEventId },
        });
        if (existingEventLog) {
          console.log(
            `Event ${stripeEventId} (Payout ID: ${payout.id}) already processed. Skipping.`,
          );
          return;
        }

        const transactionStatus = TransactionStatus.FAILED; // Directly from event type

        let platformUserId: string | null = null;
        const stripeAccountRecord = await prisma.stripeAccount.findUnique({
          where: { stripe_connect_id: connectedAccountId },
        });
        if (stripeAccountRecord) {
          platformUserId = stripeAccountRecord.user_id;
        } else {
          console.warn(
            `No StripeAccount record found for connectedAccountId: ${connectedAccountId} during payout.failed handling for Payout ID: ${payout.id}`,
          );
        }

        let parentPayoutTransaction = await prisma.transaction.findUnique({
          where: { stripe_payout_id: payout.id },
        });

        // 2. Staleness Check
        if (
          parentPayoutTransaction?.last_event_time &&
          stripeEventCreatedAt <= parentPayoutTransaction.last_event_time
        ) {
          console.log(
            `Stale event ${stripeEventId} for failed payout ${payout.id} received. Skipping.`,
          );
          return;
        }

        const description = `Payout to bank failed. Payout ID: ${payout.id}. Reason: ${payout.failure_code || 'N/A'} - ${payout.failure_message || 'No details'}`;

        if (!parentPayoutTransaction) {
          try {
            parentPayoutTransaction = await prisma.transaction.create({
              data: {
                type: TransactionType.PAYOUT,
                status: transactionStatus,
                amount: payout.amount,
                currency: payout.currency,
                description: description,
                user_id: platformUserId,
                stripe_payout_id: payout.id,
                stripe_connected_account_id: connectedAccountId,
                stripe_balance_transaction_id:
                  typeof payout.balance_transaction === 'string'
                    ? payout.balance_transaction
                    : null,
                processed_at: new Date(),
                metadata: JSON.parse(JSON.stringify(payout)),
                last_event_time: stripeEventCreatedAt,
              },
            });
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              parentPayoutTransaction = await prisma.transaction.findUnique({
                where: { stripe_payout_id: payout.id },
              });
              if (!parentPayoutTransaction) {
                throw new Error(
                  `Failed to handle race condition for failed Payout ${payout.id}`,
                );
              }
            } else {
              throw e;
            }
          }
        } else {
          parentPayoutTransaction = await prisma.transaction.update({
            where: { id: parentPayoutTransaction.id },
            data: {
              status: transactionStatus,
              description: description,
              user_id: platformUserId || parentPayoutTransaction.user_id,
              processed_at: new Date(),
              metadata: JSON.parse(JSON.stringify(payout)),
              last_event_time: stripeEventCreatedAt,
            },
          });
        }

        await prisma.transactionEventLog.create({
          data: {
            transaction_id: parentPayoutTransaction.id,
            stripe_event_id: stripeEventId,
            stripe_event_type: 'payout.failed',
            status: transactionStatus,
            details: JSON.parse(JSON.stringify(payout)),
            stripe_event_created_at: stripeEventCreatedAt,
          },
        });
      });
    } catch (error) {
      console.error('Error in handlePayoutFailed:', {
        payoutId: payout.id,
        eventId: stripeEventId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
      throw error;
    }
  }

  private mapPaymentIntentStatusToTransactionStatus(
    piStatus: Stripe.PaymentIntent.Status,
  ): TransactionStatus {
    switch (piStatus) {
      case 'succeeded':
        return TransactionStatus.SUCCEEDED;
      case 'processing':
        return TransactionStatus.PROCESSING;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'requires_capture':
        return TransactionStatus.REQUIRES_ACTION;
      case 'canceled':
        return TransactionStatus.CANCELED;
      default:
        console.warn(
          `Unhandled Stripe PaymentIntent status: ${piStatus}. Defaulting to PENDING.`,
        );
        return TransactionStatus.PENDING;
    }
  }

  async handlePaymentIntentProcessing(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);

    this.validateWebhookEvent(paymentIntent, 'payment_intent');
    console.log(
      `Processing payment_intent.processing: ${paymentIntent.id}, Event ID: ${stripeEventId}`,
    );

    await this.prisma.$transaction(async (prisma) => {
      // 1. Idempotency Check
      const existingEventLog = await prisma.transactionEventLog.findUnique({
        where: { stripe_event_id: stripeEventId },
      });
      if (existingEventLog) {
        console.log(
          `Event ${stripeEventId} (PI: ${paymentIntent.id}) already processed. Skipping.`,
        );
        return;
      }

      // 2. Find or Create Parent Transaction
      let parentChargeTransaction = await prisma.transaction.findFirst({
        where: {
          stripe_payment_intent_id: paymentIntent.id,
          type: TransactionType.PAYMENT_INTENT_CHARGE,
        },
      });

      // Staleness Check
      if (
        parentChargeTransaction?.last_event_time &&
        stripeEventCreatedAt <= parentChargeTransaction.last_event_time
      ) {
        console.log(
          `Stale event ${stripeEventId} for processing PI ${paymentIntent.id} received. Skipping.`,
        );
        return;
      }

      const description = `PaymentIntent processing. PI: ${paymentIntent.id}`;
      const newStatus = TransactionStatus.PROCESSING;

      const chargeId =
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;
      const payerUserId =
        (paymentIntent.metadata as any)?.payer_user_id || null;
      const gameId = (paymentIntent.metadata as any)?.game_id || null;
      const gamePlayerId =
        (paymentIntent.metadata as any)?.game_player_id || null;
      const customerId =
        typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : paymentIntent.customer?.id;
      const connectedAccountId =
        typeof paymentIntent.transfer_data?.destination === 'string'
          ? paymentIntent.transfer_data.destination
          : paymentIntent.transfer_data?.destination?.id;

      if (!parentChargeTransaction) {
        try {
          parentChargeTransaction = await prisma.transaction.create({
            data: {
              type: TransactionType.PAYMENT_INTENT_CHARGE,
              status: newStatus,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              description: description,
              user_id: payerUserId,
              game_id: gameId,
              game_player_id: gamePlayerId,
              stripe_payment_intent_id: paymentIntent.id,
              stripe_charge_id: chargeId,
              stripe_customer_id: customerId,
              stripe_connected_account_id: connectedAccountId,
              processed_at: new Date(),
              metadata: paymentIntent.metadata,
              last_event_time: stripeEventCreatedAt,
            },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            console.warn(
              `Race condition? CHARGE transaction for PI ${paymentIntent.id} created concurrently. Refetching.`,
            );
            parentChargeTransaction = await prisma.transaction.findFirst({
              where: {
                stripe_payment_intent_id: paymentIntent.id,
                type: TransactionType.PAYMENT_INTENT_CHARGE,
              },
            });
            if (!parentChargeTransaction) {
              throw new Error(
                `Failed to refetch CHARGE transaction for PI ${paymentIntent.id} after P2002. Critical error.`,
              );
            }
          } else {
            throw e;
          }
        }
      } else {
        parentChargeTransaction = await prisma.transaction.update({
          where: { id: parentChargeTransaction.id },
          data: {
            status: newStatus,
            description: description,
            processed_at: new Date(),
            metadata: paymentIntent.metadata,
            last_event_time: stripeEventCreatedAt,
          },
        });
      }

      // 3. Create TransactionEventLog
      await prisma.transactionEventLog.create({
        data: {
          transaction_id: parentChargeTransaction.id,
          stripe_event_id: stripeEventId,
          stripe_event_type: 'payment_intent.processing',
          status: newStatus,
          details: JSON.parse(JSON.stringify(paymentIntent)),
          stripe_event_created_at: stripeEventCreatedAt,
        },
      });
    });
  }

  async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);

    this.validateWebhookEvent(paymentIntent, 'payment_intent');
    console.log(
      `Processing payment_intent.payment_failed: ${paymentIntent.id}, Event ID: ${stripeEventId}`,
    );

    await this.prisma.$transaction(async (prisma) => {
      // 1. Idempotency Check
      const existingEventLog = await prisma.transactionEventLog.findUnique({
        where: { stripe_event_id: stripeEventId },
      });
      if (existingEventLog) {
        console.log(
          `Event ${stripeEventId} (PI: ${paymentIntent.id}) already processed. Skipping.`,
        );
        return;
      }

      // 2. Find or Create Parent Transaction
      let parentChargeTransaction = await prisma.transaction.findFirst({
        where: {
          stripe_payment_intent_id: paymentIntent.id,
          type: TransactionType.PAYMENT_INTENT_CHARGE,
        },
      });

      // Staleness Check
      if (
        parentChargeTransaction?.last_event_time &&
        stripeEventCreatedAt <= parentChargeTransaction.last_event_time
      ) {
        console.log(
          `Stale event ${stripeEventId} for failed PI ${paymentIntent.id} received. Skipping.`,
        );
        return;
      }

      const description = `PaymentIntent failed. PI: ${paymentIntent.id}. Last Error: ${paymentIntent.last_payment_error?.message || 'N/A'}`;
      const newStatus = TransactionStatus.FAILED;

      const chargeId =
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;
      const payerUserId =
        (paymentIntent.metadata as any)?.payer_user_id || null;
      const gameId = (paymentIntent.metadata as any)?.game_id || null;
      const gamePlayerId =
        (paymentIntent.metadata as any)?.game_player_id || null;
      const customerId =
        typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : paymentIntent.customer?.id;
      const connectedAccountId =
        typeof paymentIntent.transfer_data?.destination === 'string'
          ? paymentIntent.transfer_data.destination
          : paymentIntent.transfer_data?.destination?.id;

      if (!parentChargeTransaction) {
        try {
          parentChargeTransaction = await prisma.transaction.create({
            data: {
              type: TransactionType.PAYMENT_INTENT_CHARGE,
              status: newStatus,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              description: description,
              user_id: payerUserId,
              game_id: gameId,
              game_player_id: gamePlayerId,
              stripe_payment_intent_id: paymentIntent.id,
              stripe_charge_id: chargeId,
              stripe_customer_id: customerId,
              stripe_connected_account_id: connectedAccountId,
              processed_at: new Date(),
              metadata: paymentIntent.metadata,
              last_event_time: stripeEventCreatedAt,
            },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            console.warn(
              `Race condition? CHARGE transaction for PI ${paymentIntent.id} created concurrently. Refetching.`,
            );
            parentChargeTransaction = await prisma.transaction.findFirst({
              where: {
                stripe_payment_intent_id: paymentIntent.id,
                type: TransactionType.PAYMENT_INTENT_CHARGE,
              },
            });
            if (!parentChargeTransaction) {
              throw new Error(
                `Failed to refetch CHARGE transaction for PI ${paymentIntent.id} after P2002. Critical error.`,
              );
            }
          } else {
            throw e;
          }
        }
      } else {
        parentChargeTransaction = await prisma.transaction.update({
          where: { id: parentChargeTransaction.id },
          data: {
            status: newStatus,
            description: description,
            processed_at: new Date(),
            metadata: paymentIntent.metadata,
            last_event_time: stripeEventCreatedAt,
          },
        });
      }

      // 3. Create TransactionEventLog
      await prisma.transactionEventLog.create({
        data: {
          transaction_id: parentChargeTransaction.id,
          stripe_event_id: stripeEventId,
          stripe_event_type: 'payment_intent.payment_failed',
          status: newStatus,
          details: JSON.parse(JSON.stringify(paymentIntent)),
          stripe_event_created_at: stripeEventCreatedAt,
        },
      });
      console.log(
        `Created TransactionEventLog for event ${stripeEventId} (PI: ${paymentIntent.id})`,
      );

      // 4. Update GamePlayer status if needed
      if (gamePlayerId && gameId) {
        const gamePlayer = await prisma.gamePlayer.findUnique({
          where: { id: gamePlayerId },
        });

        if (gamePlayer && gamePlayer.has_paid) {
          await prisma.gamePlayer.update({
            where: { id: gamePlayerId },
            data: {
              has_paid: false,
            },
          });
          console.log(
            `Updated GamePlayer ${gamePlayerId} has_paid to false due to payment failure for PI: ${paymentIntent.id}`,
          );

          // 5. Update Game payment status
          const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: { where: { deleted_at: null } } },
          });

          if (game) {
            const somePlayersPaid = game.players.some((p) => p.has_paid);
            const newPaymentStatus = somePlayersPaid
              ? 'PARTIALLY_PAID'
              : 'PENDING';

            if (newPaymentStatus !== game.payment_status) {
              await prisma.game.update({
                where: { id: gameId },
                data: { payment_status: newPaymentStatus },
              });
              console.log(
                `Updated Game ${gameId} payment status to ${newPaymentStatus} due to payment failure`,
              );
            }
          }
        }
      }
    });
  }

  async handlePaymentIntentCanceled(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);

    this.validateWebhookEvent(paymentIntent, 'payment_intent');
    console.log(
      `Processing payment_intent.canceled: ${paymentIntent.id}, Event ID: ${stripeEventId}`,
    );

    await this.prisma.$transaction(async (prisma) => {
      // 1. Idempotency Check
      const existingEventLog = await prisma.transactionEventLog.findUnique({
        where: { stripe_event_id: stripeEventId },
      });
      if (existingEventLog) {
        console.log(
          `Event ${stripeEventId} (PI: ${paymentIntent.id}) already processed. Skipping.`,
        );
        return;
      }

      // 2. Find or Create Parent Transaction
      let parentChargeTransaction = await prisma.transaction.findFirst({
        where: {
          stripe_payment_intent_id: paymentIntent.id,
          type: TransactionType.PAYMENT_INTENT_CHARGE,
        },
      });

      // Staleness Check
      if (
        parentChargeTransaction?.last_event_time &&
        stripeEventCreatedAt <= parentChargeTransaction.last_event_time
      ) {
        console.log(
          `Stale event ${stripeEventId} for canceled PI ${paymentIntent.id} received. Skipping.`,
        );
        return;
      }

      const description = `PaymentIntent canceled. PI: ${paymentIntent.id}. Reason: ${paymentIntent.cancellation_reason || 'N/A'}`;
      const newStatus = TransactionStatus.CANCELED;

      const chargeId =
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;
      const payerUserId =
        (paymentIntent.metadata as any)?.payer_user_id || null;
      const gameId = (paymentIntent.metadata as any)?.game_id || null;
      const gamePlayerId =
        (paymentIntent.metadata as any)?.game_player_id || null;
      const customerId =
        typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : paymentIntent.customer?.id;
      const connectedAccountId =
        typeof paymentIntent.transfer_data?.destination === 'string'
          ? paymentIntent.transfer_data.destination
          : paymentIntent.transfer_data?.destination?.id;

      if (!parentChargeTransaction) {
        try {
          parentChargeTransaction = await prisma.transaction.create({
            data: {
              type: TransactionType.PAYMENT_INTENT_CHARGE,
              status: newStatus,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              description: description,
              user_id: payerUserId,
              game_id: gameId,
              game_player_id: gamePlayerId,
              stripe_payment_intent_id: paymentIntent.id,
              stripe_charge_id: chargeId,
              stripe_customer_id: customerId,
              stripe_connected_account_id: connectedAccountId,
              processed_at: new Date(),
              metadata: paymentIntent.metadata,
              last_event_time: stripeEventCreatedAt,
            },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            console.warn(
              `Race condition? CHARGE transaction for PI ${paymentIntent.id} created concurrently. Refetching.`,
            );
            parentChargeTransaction = await prisma.transaction.findFirst({
              where: {
                stripe_payment_intent_id: paymentIntent.id,
                type: TransactionType.PAYMENT_INTENT_CHARGE,
              },
            });
            if (!parentChargeTransaction) {
              throw new Error(
                `Failed to refetch CHARGE transaction for PI ${paymentIntent.id} after P2002. Critical error.`,
              );
            }
          } else {
            throw e;
          }
        }
      } else {
        parentChargeTransaction = await prisma.transaction.update({
          where: { id: parentChargeTransaction.id },
          data: {
            status: newStatus,
            description: description,
            processed_at: new Date(),
            metadata: paymentIntent.metadata,
            last_event_time: stripeEventCreatedAt,
          },
        });
      }

      // 3. Create TransactionEventLog
      await prisma.transactionEventLog.create({
        data: {
          transaction_id: parentChargeTransaction.id,
          stripe_event_id: stripeEventId,
          stripe_event_type: 'payment_intent.canceled',
          status: newStatus,
          details: JSON.parse(JSON.stringify(paymentIntent)),
          stripe_event_created_at: stripeEventCreatedAt,
        },
      });
      console.log(
        `Created TransactionEventLog for event ${stripeEventId} (PI: ${paymentIntent.id})`,
      );

      // 4. Update GamePlayer status if needed
      if (gamePlayerId && gameId) {
        const gamePlayer = await prisma.gamePlayer.findUnique({
          where: { id: gamePlayerId },
        });

        if (gamePlayer && gamePlayer.has_paid) {
          await prisma.gamePlayer.update({
            where: { id: gamePlayerId },
            data: {
              has_paid: false,
            },
          });
          console.log(
            `Updated GamePlayer ${gamePlayerId} has_paid to false due to payment cancellation for PI: ${paymentIntent.id}`,
          );

          // 5. Update Game payment status
          const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: { where: { deleted_at: null } } },
          });

          if (game) {
            const somePlayersPaid = game.players.some((p) => p.has_paid);
            const newPaymentStatus = somePlayersPaid
              ? 'PARTIALLY_PAID'
              : 'PENDING';

            if (newPaymentStatus !== game.payment_status) {
              await prisma.game.update({
                where: { id: gameId },
                data: { payment_status: newPaymentStatus },
              });
              console.log(
                `Updated Game ${gameId} payment status to ${newPaymentStatus} due to payment cancellation`,
              );
            }
          }
        }
      }
    });
  }

  async handleApplicationFeeCreated(event: Stripe.Event): Promise<void> {
    const applicationFee = event.data.object as Stripe.ApplicationFee;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);

    this.validateWebhookEvent(applicationFee, 'application_fee');

    try {
      await this.executeWithRetry(async (prisma) => {
        // 1. Idempotency Check
        const existingEventLog = await prisma.transactionEventLog.findUnique({
          where: { stripe_event_id: stripeEventId },
        });
        if (existingEventLog) {
          console.log(
            `Event ${stripeEventId} (AppFee ID: ${applicationFee.id}) already processed. Skipping.`,
          );
          return;
        }

        const newStatus = TransactionStatus.SUCCEEDED;

        const paymentIntentId: string | null =
          typeof (applicationFee['payment_intent'] as string | undefined) ===
          'string'
            ? (applicationFee['payment_intent'] as string)
            : null;

        const originatingChargeId =
          typeof applicationFee.originating_transaction === 'string'
            ? applicationFee.originating_transaction
            : null;

        let associatedUserId: string | null = null;
        const connectedAccountIdString =
          typeof (applicationFee['account'] as string | undefined) === 'string'
            ? (applicationFee['account'] as string)
            : null;

        if (connectedAccountIdString) {
          const stripeAccountRecord = await prisma.stripeAccount.findUnique({
            where: { stripe_connect_id: connectedAccountIdString },
          });
          if (stripeAccountRecord) {
            associatedUserId = stripeAccountRecord.user_id;
          }
        }

        let parentAppFeeTransaction = await prisma.transaction.findUnique({
          where: { stripe_application_fee_id: applicationFee.id },
        });

        // Staleness Check
        if (
          parentAppFeeTransaction?.last_event_time &&
          stripeEventCreatedAt <= parentAppFeeTransaction.last_event_time
        ) {
          console.log(
            `Stale event ${stripeEventId} for application fee ${applicationFee.id} received. Skipping.`,
          );
          return;
        }

        const description = `Application fee collected. Fee ID: ${applicationFee.id}. Original Charge/PI: ${paymentIntentId || originatingChargeId || 'N/A'}`;

        if (!parentAppFeeTransaction) {
          try {
            parentAppFeeTransaction = await prisma.transaction.create({
              data: {
                type: TransactionType.APPLICATION_FEE,
                status: newStatus,
                amount: applicationFee.amount,
                currency: applicationFee.currency,
                description: description,
                user_id: associatedUserId,
                stripe_application_fee_id: applicationFee.id,
                stripe_payment_intent_id: paymentIntentId,
                stripe_charge_id: originatingChargeId,
                stripe_connected_account_id: connectedAccountIdString,
                processed_at: new Date(),
                metadata: JSON.parse(JSON.stringify(applicationFee)),
                last_event_time: stripeEventCreatedAt,
              },
            });
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              parentAppFeeTransaction = await prisma.transaction.findUnique({
                where: { stripe_application_fee_id: applicationFee.id },
              });
              if (!parentAppFeeTransaction) {
                throw new Error(
                  `Failed to handle race condition for application fee ${applicationFee.id}`,
                );
              }
            } else {
              throw e;
            }
          }
        } else {
          parentAppFeeTransaction = await prisma.transaction.update({
            where: { id: parentAppFeeTransaction.id },
            data: {
              status: newStatus,
              amount: applicationFee.amount,
              description: description,
              processed_at: new Date(),
              metadata: JSON.parse(JSON.stringify(applicationFee)),
              last_event_time: stripeEventCreatedAt,
            },
          });
        }

        await prisma.transactionEventLog.create({
          data: {
            transaction_id: parentAppFeeTransaction.id,
            stripe_event_id: stripeEventId,
            stripe_event_type: 'application_fee.created',
            status: newStatus,
            details: JSON.parse(JSON.stringify(applicationFee)),
            stripe_event_created_at: stripeEventCreatedAt,
          },
        });
      });
    } catch (error) {
      console.error('Error in handleApplicationFeeCreated:', {
        applicationFeeId: applicationFee.id,
        eventId: stripeEventId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
      throw error;
    }
  }

  async handleApplicationFeeRefundUpdated(event: Stripe.Event): Promise<void> {
    const feeRefund = event.data.object as Stripe.FeeRefund;
    const stripeEventId = event.id;
    const stripeEventCreatedAt = new Date(event.created * 1000);

    // Stripe's FeeRefund object doesn't have an 'object' property like others,
    // so we validate based on what we expect.
    if (!feeRefund.id || !feeRefund.fee) {
      throw new BadRequestException(
        'Invalid fee_refund object in webhook event',
      );
    }

    try {
      await this.executeWithRetry(async (prisma) => {
        // 1. Idempotency Check
        const existingEventLog = await prisma.transactionEventLog.findUnique({
          where: { stripe_event_id: stripeEventId },
        });
        if (existingEventLog) {
          console.log(
            `Event ${stripeEventId} (FeeRefund ID: ${feeRefund.id}) already processed. Skipping.`,
          );
          return;
        }

        // --- New: Logic to find associated user ---
        const feeId =
          typeof feeRefund.fee === 'string' ? feeRefund.fee : feeRefund.fee.id;
        let associatedUserId: string | null = null;
        try {
          const applicationFee =
            await this.stripe.applicationFees.retrieve(feeId);
          const connectedAccountId =
            typeof applicationFee.account === 'string'
              ? applicationFee.account
              : applicationFee.account.id;

          if (connectedAccountId) {
            const stripeAccountRecord = await prisma.stripeAccount.findUnique({
              where: { stripe_connect_id: connectedAccountId },
            });
            if (stripeAccountRecord) {
              associatedUserId = stripeAccountRecord.user_id;
            } else {
              console.warn(
                `Could not find StripeAccount for connected account ${connectedAccountId} when processing fee refund ${feeRefund.id}`,
              );
            }
          }
        } catch (e) {
          console.error(
            `Failed to retrieve Application Fee ${feeId} for Fee Refund ${feeRefund.id}:`,
            e,
          );
          // Continue without user_id, it's not critical enough to fail the whole process.
        }
        // --- End New Logic ---

        let parentRefundTransaction = await prisma.transaction.findUnique({
          where: { stripe_application_fee_refund_id: feeRefund.id },
        });

        // 2. Staleness Check
        if (
          parentRefundTransaction?.last_event_time &&
          stripeEventCreatedAt <= parentRefundTransaction.last_event_time
        ) {
          console.log(
            `Stale event ${stripeEventId} for fee refund ${feeRefund.id} received. Skipping.`,
          );
          return;
        }

        const newStatus =
          feeRefund.balance_transaction &&
          typeof feeRefund.balance_transaction === 'string'
            ? TransactionStatus.SUCCEEDED
            : TransactionStatus.PENDING;
        const description = `Application fee refund processed. FeeRefund ID: ${feeRefund.id}. Original Fee: ${feeRefund.fee}.`;

        if (!parentRefundTransaction) {
          try {
            parentRefundTransaction = await prisma.transaction.create({
              data: {
                type: TransactionType.APPLICATION_FEE_REFUND,
                status: newStatus,
                amount: feeRefund.amount,
                currency: feeRefund.currency,
                description: description,
                user_id: associatedUserId, // Set user_id here
                stripe_application_fee_id: feeRefund.fee as string,
                stripe_application_fee_refund_id: feeRefund.id,
                stripe_balance_transaction_id:
                  typeof feeRefund.balance_transaction === 'string'
                    ? feeRefund.balance_transaction
                    : null,
                processed_at: new Date(),
                metadata: JSON.parse(JSON.stringify(feeRefund)),
                last_event_time: stripeEventCreatedAt,
              },
            });
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              parentRefundTransaction = await prisma.transaction.findUnique({
                where: { stripe_application_fee_refund_id: feeRefund.id },
              });
              if (!parentRefundTransaction) {
                throw new Error(
                  `Failed to handle race condition for fee refund ${feeRefund.id}`,
                );
              }
            } else {
              throw e;
            }
          }
        } else {
          parentRefundTransaction = await prisma.transaction.update({
            where: { id: parentRefundTransaction.id },
            data: {
              status: newStatus,
              description: description,
              user_id: associatedUserId || parentRefundTransaction.user_id, // Update user_id here
              processed_at: new Date(),
              metadata: JSON.parse(JSON.stringify(feeRefund)),
              last_event_time: stripeEventCreatedAt,
            },
          });
        }

        await prisma.transactionEventLog.create({
          data: {
            transaction_id: parentRefundTransaction.id,
            stripe_event_id: stripeEventId,
            stripe_event_type: 'application_fee.refund.updated',
            status: newStatus,
            details: JSON.parse(JSON.stringify(feeRefund)),
            stripe_event_created_at: stripeEventCreatedAt,
          },
        });
      });
    } catch (error) {
      console.error('Error in handleApplicationFeeRefundUpdated:', {
        feeRefundId: feeRefund.id,
        eventId: stripeEventId,
        error,
      });
      throw error;
    }
  }

  async createVirtualCardForGame(
    authId: string,
    gameId: string,
  ): Promise<{
    card_id: string;
    card_number: string;
    last4: string;
    cvc: string;
    exp_month: number;
    exp_year: number;
    amount_pence: number;
    status: string;
  }> {
    console.log(
      `Request to create virtual card for game ${gameId} by user with authId ${authId}`,
    );
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });
    if (!game) {
      console.warn(`Game with ID ${gameId} not found when requesting virtual card`);
      throw new NotFoundException('Game not found');
    }
    if (game.creator_id !== user.id) {
      console.warn(`User ${user.id} is not the creator of game ${gameId} and cannot request a virtual card`);
      throw new BadRequestException(
        'Only the game creator can request a virtual card',
      );
    }
    if (game.status !== 'READY_TO_BOOK') {
      console.warn(`Game ${gameId} is in status ${game.status} and not READY_TO_BOOK. Cannot issue virtual card.`);
      throw new BadRequestException(
        'A virtual card can only be issued when the game is in READY_TO_BOOK status',
      );
    }
    if (game.payment_status !== 'FULLY_PAID') {
      console.warn(`Game ${gameId} has payment status ${game.payment_status} and is not FULLY_PAID. Cannot issue virtual card.`);
      throw new BadRequestException(
        'A virtual card can only be issued when the game payment status is FULLY_PAID',
      );
    }
    const { profile } = user;
    if (
      !profile?.first_name ||
      !profile?.last_name ||
      !profile?.mobile_number ||
      !profile?.address_line_1 ||
      !profile?.city ||
      !profile?.postcode ||
      !profile?.country
    ) {
      console.warn(`User profile for user ${user.id} is incomplete. Cannot issue virtual card. Profile: ${JSON.stringify(profile)}`);
      throw new BadRequestException(
        'User profile is incomplete. first_name, last_name, mobile_number, address_line_1, city, postcode, and country are required to issue a virtual card',
      );
    }
    if (!game.cost_per_player) {
      console.warn(`Game ${gameId} does not have cost_per_player set. Cannot calculate card limit. Game data: ${JSON.stringify(game)}`);
      throw new BadRequestException(
        'Game does not have a cost per player set',
      );
    }

    if (game.stripe_card_id) {
      console.log(
        `Virtual card already exists for game ${gameId}: ${game.stripe_card_id}`,
      );
      const existingCard = await this.stripe.issuing.cards.retrieve(
        game.stripe_card_id,
        { expand: ['number', 'cvc'] },
      );
      return {
        card_id: existingCard.id,
        card_number: (existingCard as any).number,
        last4: existingCard.last4,
        cvc: (existingCard as any).cvc,
        exp_month: existingCard.exp_month,
        exp_year: existingCard.exp_year,
        amount_pence: game.players_current * game.cost_per_player,
        status: existingCard.status,
      };
    }

    const amount = game.players_current * game.cost_per_player;
    console.log(
      `Calculated card limit for game ${gameId}: ${amount} pence (players: ${game.players_current}, cost per player: ${game.cost_per_player} pence)`,
    );

    try {
      const cardholder = await this.stripe.issuing.cardholders.create({
        type: 'individual',
        name: `${profile.first_name} ${profile.last_name}`,
        email: user.email,
        phone_number: profile.mobile_number,
        billing: {
          address: {
            line1: profile.address_line_1,
            city: profile.city,
            postal_code: profile.postcode,
            country: profile.country,
          },
        },
        metadata: {
          app_user_id: user.id,
          game_id: gameId,
        },
      });

      const card = await this.stripe.issuing.cards.create({
        cardholder: cardholder.id,
        currency: 'gbp',
        type: 'virtual',
        spending_controls: {
          spending_limits: [{ amount, interval: 'all_time' }],
        },
        metadata: {
          game_id: gameId,
          creator_id: user.id,
        },
      });

      const cardDetails = await this.stripe.issuing.cards.retrieve(card.id, {
        expand: ['number', 'cvc'],
      });

      await this.prisma.game.update({
        where: { id: gameId },
        data: { stripe_card_id: card.id },
      });

      console.log(
        `Created virtual card ${card.id} for game ${gameId} with limit ${amount} pence`,
      );
      return {
        card_id: card.id,
        card_number: (cardDetails as any).number,
        last4: card.last4,
        cvc: (cardDetails as any).cvc,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        amount_pence: amount,
        status: card.status,
      };
    } catch (error) {
      this.handleStripeError(error, 'createVirtualCardForGame');
    }
  }

  getPublishableKey(): string {
    const publishableKey = this.configService.get<string>(
      'STRIPE_PUBLISHABLE_KEY',
    );
    if (!publishableKey) {
      throw new InternalServerErrorException(
        'Stripe publishable key not configured',
      );
    }
    return publishableKey;
  }
}
