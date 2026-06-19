import { IsString, MinLength } from 'class-validator';

export class SearchCoursesDto {
  @IsString()
  @MinLength(1)
  searchTerm: string;
}
