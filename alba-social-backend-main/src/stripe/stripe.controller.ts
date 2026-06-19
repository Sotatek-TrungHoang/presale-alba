import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
// Trigger @types/multer's global namespace augmentation so Express.Multer.File
// is in scope when the file is type-checked in isolation.
import type {} from 'multer';
import { StripeService } from './stripe.service';
import { CreateStripeDto } from './dto/create-stripe.dto';
import { UpdateStripeDto } from './dto/update-stripe.dto';
import { CreateConnectedAccountDto } from './dto/create-connected-account.dto';
import { CreateCustomAccountDto } from './dto/create-custom-account.dto';
import { AttachExternalAccountDto } from './dto/attach-external-account.dto';
import { UpdateIndividualDto } from './dto/update-individual.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('onboarding/initiate')
  @UseGuards(FirebaseAuthGuard)
  async initiateOnboarding(
    @Request() req,
    @Body() createConnectedAccountDto: CreateConnectedAccountDto,
  ) {
    const authId = req.user.uid;

    try {
      const accountLink = await this.stripeService.initiateOnboardingFlow(
        authId,
        createConnectedAccountDto,
      );
      return { url: accountLink.url };
    } catch (error) {
      console.error(
        `Error during Stripe onboarding initiation for authId ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to initiate Stripe onboarding',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('onboarding/status')
  @UseGuards(FirebaseAuthGuard)
  async getOnboardingStatus(@Request() req) {
    const authId = req.user.uid;

    try {
      const status = await this.stripeService.getAccountStatus(authId);
      return status;
    } catch (error) {
      console.error(
        `Error retrieving Stripe account status for authId ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve Stripe account status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Native Connect Custom onboarding endpoints.
  // Replaces the hosted Express flow (`onboarding/initiate`) for new accounts and
  // for re-onboarding the existing Express users in-place.

  @Post('onboarding/account')
  @UseGuards(FirebaseAuthGuard)
  async createCustomAccount(
    @Request() req,
    @Body() dto: CreateCustomAccountDto,
  ) {
    const authId = req.user.uid;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ||
      req.ip ||
      req.socket?.remoteAddress;
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? '';

    try {
      return await this.stripeService.createCustomAccount(authId, dto, {
        ip,
        userAgent,
      });
    } catch (error) {
      console.error(
        `Error creating Stripe Custom account for authId ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create Stripe Custom account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('onboarding/external-account')
  @UseGuards(FirebaseAuthGuard)
  async attachExternalAccount(
    @Request() req,
    @Body() dto: AttachExternalAccountDto,
  ) {
    const authId = req.user.uid;

    try {
      return await this.stripeService.attachExternalAccount(
        authId,
        dto.bank_token,
      );
    } catch (error) {
      console.error(
        `Error attaching external account for authId ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to attach external account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('onboarding/requirements')
  @UseGuards(FirebaseAuthGuard)
  async getOnboardingRequirements(@Request() req) {
    const authId = req.user.uid;

    try {
      return await this.stripeService.getOnboardingRequirements(authId);
    } catch (error) {
      console.error(
        `Error retrieving Stripe onboarding requirements for authId ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve Stripe onboarding requirements',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('onboarding/individual')
  @UseGuards(FirebaseAuthGuard)
  async updateIndividual(
    @Request() req,
    @Body() dto: UpdateIndividualDto,
  ) {
    const authId = req.user.uid;

    try {
      return await this.stripeService.updateIndividual(authId, dto);
    } catch (error) {
      console.error(
        `Error updating individual for authId ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update individual',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('onboarding/document')
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, Stripe's max per file
    }),
  )
  async uploadDocument(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    const authId = req.user.uid;

    if (!file) {
      throw new BadRequestException(
        'file is required (multipart/form-data field "file")',
      );
    }

    try {
      return await this.stripeService.uploadIdentityDocument(authId, file, dto);
    } catch (error) {
      console.error(
        `Error uploading identity document for authId ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to upload identity document',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Endpoint to retrieve the Stripe publishable key for the client SDKs
  @Get('publishable-key')
  getPublishableKey() {
    try {
      const publishableKey = this.stripeService.getPublishableKey();
      return { publishableKey };
    } catch (error) {
      console.error('Error retrieving Stripe publishable key:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve Stripe publishable key',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('payment-intents/create')
  @UseGuards(FirebaseAuthGuard)
  async createPaymentIntent(
    @Request() req,
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ) {
    const payerAuthId = req.user.uid;

    try {
      const paymentIntentInfo = await this.stripeService.createPaymentIntent(
        payerAuthId,
        createPaymentIntentDto,
      );
      return paymentIntentInfo;
    } catch (error) {
      console.error(
        `Error creating PaymentIntent for payer authId ${payerAuthId} and recipient authId ${createPaymentIntentDto.recipientAuthId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create PaymentIntent',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('payouts/create')
  @UseGuards(FirebaseAuthGuard)
  async createManualPayout(
    @Request() req,
    @Body() createPayoutDto: CreatePayoutDto,
  ) {
    const initiatorAuthId = req.user.uid; // Platform user/admin initiating the payout

    try {
      // Note: createPayoutDto.stripe_account_id is the ID of the connected account
      // from whose balance the payout is being made.
      const payout = await this.stripeService.createManualPayout(
        initiatorAuthId,
        {
          amount: createPayoutDto.amount,
          currency: createPayoutDto.currency,
          connectedAccountId: createPayoutDto.stripe_account_id, // Pass the Stripe Account ID here
          // description: "Optional payout description", // You can add these if needed
          // metadata: { game_id: "some_game_id" },
        },
      );
      return {
        success: true,
        payout_id: payout.id,
        status: payout.status,
        message: 'Payout initiated successfully.',
      };
    } catch (error) {
      console.error(
        `Error during manual payout from account ${createPayoutDto.stripe_account_id} initiated by authId ${initiatorAuthId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to initiate manual payout',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refunds/create')
  @UseGuards(FirebaseAuthGuard)
  async createRefund(@Request() req, @Body() createRefundDto: CreateRefundDto) {
    const initiatorAuthId = req.user.uid;

    if (createRefundDto.amount !== undefined && createRefundDto.amount <= 0) {
      throw new HttpException(
        'Refund amount must be positive if specified.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const refund = await this.stripeService.createRefund(
        initiatorAuthId,
        createRefundDto,
      );
      return {
        success: true,
        refund_id: refund.id,
        status: refund.status,
        message: 'Refund initiated successfully.',
      };
    } catch (error) {
      console.error(
        `Error processing refund for PaymentIntent ${createRefundDto.paymentIntentId} by authId ${initiatorAuthId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to process refund',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
