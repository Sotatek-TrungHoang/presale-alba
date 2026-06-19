import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { GameFormat, GameType, HandicapRange, TimeSlot } from '@prisma/client';

export class CreateGameDto {
  @ApiProperty({ minimum: 2 })
  @IsInt()
  @Min(2)
  @Type(() => Number)
  players_needed: number;

  @ApiProperty()
  @Type(() => Date)
  date: Date;

  @ApiProperty({ enum: TimeSlot })
  @IsEnum(TimeSlot)
  time_slot: TimeSlot;

  @ApiProperty({ enum: GameType })
  @IsEnum(GameType)
  game_type: GameType;

  @ApiProperty({ enum: GameFormat })
  @IsEnum(GameFormat)
  game_format: GameFormat;

  @ApiProperty()
  @IsString()
  @IsUUID()
  course_id: string;

  @ApiProperty({ enum: HandicapRange })
  @IsEnum(HandicapRange)
  organiser_handicap: HandicapRange;

  @ApiPropertyOptional({ description: 'Cost per player in pence (e.g. 1350)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20000)
  cost_per_player?: number;
}
