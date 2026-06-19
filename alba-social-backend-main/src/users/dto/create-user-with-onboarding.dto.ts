import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEmail,
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

export class CreateUserWithOnboardingDto {
  // Basic user data
  @IsString()
  auth_id: string;

  @IsEmail()
  email: string;

  @IsBoolean()
  admin_status: boolean;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  // Onboarding data
  @IsEnum(HandicapRange)
  handicapRange: HandicapRange;

  @IsEnum(PlayerType)
  playerType: PlayerType;

  @IsArray()
  preferences: GameType[];

  @IsOptional()
  availability?: AvailabilityDto;

  @IsOptional()
  @IsArray()
  homeCourses?: string[];
}
