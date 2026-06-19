import { IsOptional, IsString } from 'class-validator';

export class AddCommentDto {
  @IsString()
  postId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}
