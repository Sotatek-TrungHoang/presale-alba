import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddAdminGamePlayerDto {
  @ApiProperty({
    description: 'User ID to add to the game',
    example: 'user-123',
  })
  @IsString()
  user_id: string;
}