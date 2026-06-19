import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateGameDto } from './create-game.dto';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Omit fields that shouldn't be updated directly
export class UpdateGameDto extends PartialType(
  OmitType(CreateGameDto, [
    'players_current',
    'invited_users',
    'is_booked',
  ] as const),
) {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  course_id?: string;

  @IsOptional()
  @IsString()
  group_id?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  distance?: number;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(54)
  handicap_min?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(54)
  handicap_max?: number;

  @IsOptional()
  @IsDateString()
  date?: Date;

  @IsOptional()
  @IsIn(['EARLY_MORNING', 'LATE_MORNING', 'LUNCHTIME', 'LATE_AFTERNOON'])
  time_slot?: 'EARLY_MORNING' | 'LATE_MORNING' | 'LUNCHTIME' | 'LATE_AFTERNOON';

  @IsOptional()
  @IsString()
  exact_time?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  players_needed?: number;

  @IsOptional()
  @IsIn([
    'PURELY_SOCIAL',
    'RELAXED_ROUND',
    'COMPETITIVE_MATCH',
    'BEGINNER_FRIENDLY',
  ])
  game_type?:
    | 'PURELY_SOCIAL'
    | 'RELAXED_ROUND'
    | 'COMPETITIVE_MATCH'
    | 'BEGINNER_FRIENDLY';

  @IsOptional()
  @IsIn([
    'MATCHPLAY',
    'STROKEPLAY',
    'SCRAMBLE',
    'STABLEFORD',
    'BEST_BALL',
    'DONT_KNOW_YET',
  ])
  game_format?:
    | 'MATCHPLAY'
    | 'STROKEPLAY'
    | 'SCRAMBLE'
    | 'STABLEFORD'
    | 'BEST_BALL'
    | 'DONT_KNOW_YET';

  @IsOptional()
  @IsIn(['LOW', 'MID', 'HIGH', 'DONT_KNOW'])
  organiser_handicap?: 'LOW' | 'MID' | 'HIGH' | 'DONT_KNOW';

  @IsOptional()
  @IsNumber()
  @Min(0)
  /**
   * Accepts a float (e.g. 55.00 for £55) and converts to integer pence/cents (e.g. 5500)
   */
  @Transform(({ value }) =>
    value !== undefined ? Math.round(value * 100) : value,
  )
  total_cost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  /**
   * Accepts a float (e.g. 13.50 for £13.50) and converts to integer pence/cents (e.g. 1350)
   */
  @Transform(({ value }) =>
    value !== undefined ? Math.round(value * 100) : value,
  )
  cost_per_player?: number;
}
