import { IsString } from 'class-validator';

export class FollowUserDto {
  @IsString()
  followingId: string;
}
