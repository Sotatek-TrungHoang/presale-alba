import { IsString, MinLength } from 'class-validator';

export class SearchLocationsDto {
  @IsString()
  @MinLength(1)
  searchTerm: string;
}
