import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
} from 'class-validator';
import { GameType, HandicapRange, PlayerType, TimeSlot } from '@prisma/client';

export class AvailabilityDto {
  @IsOptional()
  @IsArray()
  weekdays?: TimeSlot[];

  @IsOptional()
  @IsArray()
  weekends?: TimeSlot[];
}

export class UserProfileDto {
  // Profile data
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

  // Onboarding data
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

export class UserProfileResponseDto {
  id: string;
  first_name?: string;
  last_name?: string;
  handicap?: number;
  photo?: string;
  address_line_1?: string;
  address_line_2?: string;
  postcode?: string;
  city?: string;
  country?: string;
  mobile_number?: string;
  lat?: number;
  lng?: number;
  handicapRange?: HandicapRange;
  playerType?: PlayerType;
  preferences?: GameType[];
  availability?: {
    weekday_slots: any[];
    weekend_slots: any[];
  };
  homeCourses?: any[];
  onboardingCompleted: boolean;
}
