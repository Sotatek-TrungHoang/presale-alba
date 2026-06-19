import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreatePayoutDto {
  @IsNotEmpty()
  @IsString()
  stripe_account_id: string; // The Stripe Connect account ID of the recipient

  @IsNotEmpty()
  @IsNumber()
  @Min(1) // Assuming payout amount must be at least 1 unit of currency (e.g., 1 cent)
  amount: number; // Amount in the smallest currency unit (e.g., cents, pence)

  @IsNotEmpty()
  @IsString()
  currency: string; // e.g., 'gbp', 'usd'
}
