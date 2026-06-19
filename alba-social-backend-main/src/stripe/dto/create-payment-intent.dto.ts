import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  IsOptional,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentIntentMetadataDto {
  @IsOptional()
  @IsString()
  game_id?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Add any other relevant metadata fields
}

export class CreatePaymentIntentDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(50) // Stripe has minimum charge amounts (e.g., 50 cents for USD)
  amount: number; // Total amount the player is charged, in the smallest currency unit

  @IsOptional()
  @IsNumber()
  @Min(0) // Application fee cannot be negative. 0 means no fee.
  applicationFeeAmount?: number; // Optional: Amount platform intends to collect as a fee

  @IsNotEmpty()
  @IsString()
  currency: string; // e.g., 'gbp', 'usd'

  @IsNotEmpty()
  @IsString()
  recipientAuthId: string; // The auth_id of the user whose connected account will eventually receive the funds

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentIntentMetadataDto)
  metadata?: PaymentIntentMetadataDto;
}
