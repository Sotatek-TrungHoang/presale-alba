import { IsOptional, IsString } from 'class-validator';

export class LikePostDto {
  @IsString()
  postId: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}
