import { IsString, IsNotEmpty } from 'class-validator';

export class ToggleFavouriteCourseDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;
}
