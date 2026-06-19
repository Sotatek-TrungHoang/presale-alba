import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  GameFormat,
  GameType,
  TimeSlot,
} from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAdminGameDto {
  @ApiProperty({
    description: 'Scheduled game date',
    example: '2026-04-22T09:00:00.000Z',
  })
  @IsDateString()
  date: string;

  @ApiProperty({ enum: TimeSlot, example: TimeSlot.LATE_MORNING })
  @IsEnum(TimeSlot)
  time_slot: TimeSlot;

  @ApiProperty({
    description: 'Required number of players. Must be greater than 2.',
    example: 4,
  })
  @IsInt()
  @Min(3)
  players_needed: number;

  @ApiProperty({ enum: GameType, example: GameType.RELAXED_ROUND })
  @IsEnum(GameType)
  game_type: GameType;

  @ApiPropertyOptional({
    description: 'Linked golf course ID',
    example: 'course-123',
  })
  @IsOptional()
  @IsString()
  course_id?: string;

  @ApiPropertyOptional({
    description: 'Optional game format',
    enum: GameFormat,
    example: GameFormat.STROKEPLAY,
  })
  @IsOptional()
  @IsEnum(GameFormat)
  game_format?: GameFormat;

  @ApiPropertyOptional({
    description: 'Exact tee time if known',
    example: '09:12',
  })
  @IsOptional()
  @IsString()
  exact_time?: string;

}