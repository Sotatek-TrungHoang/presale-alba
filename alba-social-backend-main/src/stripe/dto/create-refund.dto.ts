import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export enum RefundReason {
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  REQUESTED_BY_CUSTOMER = 'requested_by_customer',
  // Add other reasons as appropriate for your platform
}

export class CreateRefundDto {
  @IsNotEmpty()
  @IsString()
  paymentIntentId: string; // The ID of the PaymentIntent to refund

  @IsOptional()
  @IsNumber()
  @Min(1) // If a partial refund amount is specified, it must be at least 1 unit
  amount?: number; // Optional: Amount to refund in the smallest currency unit. If omitted, full amount is refunded.

  @IsOptional()
  @IsEnum(RefundReason)
  reason?: RefundReason; // Optional: Reason for the refund

  @IsOptional()
  @IsBoolean()
  reverseTransfer?: boolean; // Optional: Defaults to true in service logic

  @IsOptional()
  @IsBoolean()
  refundApplicationFee?: boolean; // Optional: Defaults to true in service logic
}
