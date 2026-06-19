// create-group.dto.ts
import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'on' || value === true)
  isPublic: boolean;

  @IsString()
  @IsOptional()
  groupImage: string;

  @IsString()
  @IsOptional()
  groupBanner: string;

  @IsArray()
  selectedUsers: string[];
}
