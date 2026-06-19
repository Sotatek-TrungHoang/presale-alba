import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';

export class UpdateGroupDto {
  @IsString()
  groupId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  isPublic: boolean;

  @IsString()
  @IsOptional()
  groupImage?: string;

  @IsString()
  @IsOptional()
  groupBanner?: string;

  @IsArray()
  @IsOptional()
  selectedUsers?: string[];
}
