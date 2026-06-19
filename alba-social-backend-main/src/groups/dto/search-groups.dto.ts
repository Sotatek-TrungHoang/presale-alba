import { IsString } from 'class-validator';

export class SearchGroupsDto {
  @IsString()
  searchTerm: string;
}
