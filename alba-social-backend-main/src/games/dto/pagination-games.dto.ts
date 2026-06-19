import { IsIn, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GameStatus } from '@prisma/client';

export const ADMIN_GAME_STATUS_FILTERS = [
  ...Object.values(GameStatus),
  'DELETED',
] as const;

export type AdminGameStatusFilter = (typeof ADMIN_GAME_STATUS_FILTERS)[number];

export class PaginateGamesDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter games by status',
    enum: ADMIN_GAME_STATUS_FILTERS,
  })
  @IsOptional()
  @IsIn(ADMIN_GAME_STATUS_FILTERS)
  status?: AdminGameStatusFilter;
}
