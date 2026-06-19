import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
} from 'class-validator';
import { GameType, HandicapRange, PlayerType, TimeSlot } from '@prisma/client';
import { AvailabilityDto } from './availability.dto';

export class CreateProfileDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsNumber()
  handicap?: number;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  address_line_1?: string;

  @IsOptional()
  @IsString()
  address_line_2?: string;

  @IsOptional()
  @IsString()
  postcode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  mobile_number?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsEnum(HandicapRange)
  handicapRange?: HandicapRange;

  @IsOptional()
  @IsEnum(PlayerType)
  playerType?: PlayerType;

  @IsOptional()
  @IsArray()
  preferences?: GameType[];

  @IsOptional()
  availability?: AvailabilityDto;

  @IsOptional()
  @IsArray()
  homeCourses?: string[];
}
