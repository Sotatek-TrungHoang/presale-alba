import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class GetMyGamesQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'upcoming', 'completed'])
  type: 'pending' | 'upcoming' | 'completed';
}
