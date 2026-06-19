import {
  IsString,
  MinLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlayerType, GameType, HandicapRange } from '@prisma/client';

export class SearchUsersDto {
  @IsOptional() // searchTerm is now optional as other filters can be used
  @IsString()
  @MinLength(1)
  searchTerm?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50) // Assuming km for now, adjust as needed
  distance?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(HandicapRange, { each: true })
  handicapRanges?: HandicapRange[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(PlayerType, { each: true })
  playerTypes?: PlayerType[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(GameType, { each: true })
  gamePreferences?: GameType[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50) // Standard pagination limit
  limit?: number;
}
