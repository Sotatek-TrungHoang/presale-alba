import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AttachExternalAccountDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^btok_/, {
    message: 'bank_token must be a Stripe bank account token (btok_...)',
  })
  bank_token: string;
}
