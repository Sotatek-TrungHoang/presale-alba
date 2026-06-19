import { IsString, IsNotEmpty } from 'class-validator';

export class AddReviewDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  comment: string;
}
