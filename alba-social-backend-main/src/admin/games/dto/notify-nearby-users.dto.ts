import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class NotifyNearbyUsersDto {
  @ApiProperty({
    description: 'List of user IDs to notify about the nearby game',
    type: [String],
    example: ['user-123', 'user-456'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  user_ids: string[];
}
