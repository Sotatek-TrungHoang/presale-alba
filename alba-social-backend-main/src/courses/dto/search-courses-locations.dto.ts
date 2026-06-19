import { IsString, MinLength } from 'class-validator';

export class SearchCoursesLocationsDto {
  @IsString()
  @MinLength(1)
  searchTerm: string;
}
