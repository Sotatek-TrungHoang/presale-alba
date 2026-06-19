import { ApiProperty } from '@nestjs/swagger';
import { PlayerStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateAdminGamePlayerStatusDto {
  @ApiProperty({
    description: 'New status for the game player',
    enum: PlayerStatus,
    example: PlayerStatus.APPROVED,
  })
  @IsEnum(PlayerStatus)
  status: PlayerStatus;
}