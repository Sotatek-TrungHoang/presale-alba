import { IsString } from 'class-validator';

export class FindFollowStatusDto {
  @IsString()
  followingId: string;
}
