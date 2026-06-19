import {
  Equals,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class IndividualAddressDto {
  @IsString()
  @IsNotEmpty()
  line1: string;

  @IsString()
  @IsOptional()
  line2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  postal_code: string;
}

class IndividualDobDto {
  @IsInt()
  @Min(1)
  @Max(31)
  day: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(1900)
  year: number;
}

class IndividualDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  email: string;

  @ValidateNested()
  @Type(() => IndividualDobDto)
  dob: IndividualDobDto;

  @ValidateNested()
  @Type(() => IndividualAddressDto)
  address: IndividualAddressDto;
}

export class CreateCustomAccountDto {
  @ValidateNested()
  @Type(() => IndividualDto)
  individual: IndividualDto;

  // Client must affirm the Stripe Recipient Service Agreement was shown
  // and accepted by the user before this endpoint is called. The backend
  // captures the IP and user-agent server-side and forwards them to Stripe
  // as tos_acceptance.
  @IsBoolean()
  @Equals(true, { message: 'tos_accepted must be true' })
  tos_accepted: boolean;
}
