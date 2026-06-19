import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  GameFormat,
  GameType,
  TimeSlot,
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

const emptyStringToNull = ({ value }) => (value === '' ? null : value);

export class UpdateAdminGameDto {
  @ApiPropertyOptional({
    description: 'Game creator user ID',
    example: 'user-123',
  })
  @IsOptional()
  @IsString()
  creator_id?: string;

  @ApiPropertyOptional({
    description: 'Scheduled game date',
    example: '2026-04-22T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: TimeSlot, example: TimeSlot.LATE_MORNING })
  @IsOptional()
  @IsEnum(TimeSlot)
  time_slot?: TimeSlot;

  @ApiPropertyOptional({
    description: 'Exact tee time once known',
    example: '09:12',
    nullable: true,
  })
  @IsOptional()
  @Transform(emptyStringToNull)
  @IsString()
  exact_time?: string | null;

  @ApiPropertyOptional({ description: 'Current number of players', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  players_current?: number;

  @ApiPropertyOptional({ description: 'Required number of players', example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  players_needed?: number;

  @ApiPropertyOptional({
    description: 'Linked golf course ID',
    example: 'course-123',
    nullable: true,
  })
  @IsOptional()
  @Transform(emptyStringToNull)
  @IsString()
  course_id?: string | null;

  @ApiPropertyOptional({
    description: 'Linked group ID',
    example: 'group-123',
    nullable: true,
  })
  @IsOptional()
  @Transform(emptyStringToNull)
  @IsString()
  group_id?: string | null;

  @ApiPropertyOptional({ description: 'Minimum handicap', example: 5, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(54)
  handicap_min?: number | null;

  @ApiPropertyOptional({ description: 'Maximum handicap', example: 18, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(54)
  handicap_max?: number | null;

  @ApiPropertyOptional({ enum: GameType, example: GameType.RELAXED_ROUND })
  @IsOptional()
  @IsEnum(GameType)
  game_type?: GameType;

  @ApiPropertyOptional({
    enum: GameFormat,
    example: GameFormat.STROKEPLAY,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(GameFormat)
  game_format?: GameFormat | null;

  @ApiPropertyOptional({
    description: 'Per-player cost as pence/cents; converted to minor units',
    example: 1300,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_per_player?: number | null;

  @ApiPropertyOptional({
    description: 'Stripe checkout session ID',
    example: 'cs_test_123',
    nullable: true,
  })
  @IsOptional()
  @Transform(emptyStringToNull)
  @IsString()
  stripe_session_id?: string | null;

  @ApiPropertyOptional({
    description: 'Soft delete or restore the game',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}