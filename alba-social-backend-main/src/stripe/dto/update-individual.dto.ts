import {
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
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  postal_code?: string;
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

export class UpdateIndividualDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  first_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  last_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IndividualDobDto)
  dob?: IndividualDobDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => IndividualAddressDto)
  address?: IndividualAddressDto;
}
