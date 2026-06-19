// create-post.dto.ts
import {
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsDate,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

class PlayerScoreDto {
  @IsString()
  userId: string;

  @IsArray()
  scores: number[];

  @IsNumber()
  total: number;

  @IsNumber()
  againstPar: number;
}

class RoundDataDto {
  @IsString()
  courseId: string;

  @IsString()
  teeId: string;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @ValidateNested({ each: true })
  @Type(() => PlayerScoreDto)
  players: PlayerScoreDto[];
}

export class CreatePostDto {
  @IsString()
  content: string;

  @IsEnum(['GENERAL', 'SCORE'])
  type: 'GENERAL' | 'SCORE';

  @IsOptional()
  @ValidateNested()
  @Type(() => RoundDataDto)
  roundData?: RoundDataDto;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
