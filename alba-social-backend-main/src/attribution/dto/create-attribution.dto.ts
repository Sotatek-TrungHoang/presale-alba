import {
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * A single attribution "touch" — the marketing params carried on the inbound
 * link. All fields are optional/nullable because organic or partially-tagged
 * links won't carry every param.
 */
export class AttributionTouchDto {
  @IsOptional()
  @IsString()
  source?: string | null;

  @IsOptional()
  @IsString()
  medium?: string | null;

  @IsOptional()
  @IsString()
  campaign?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  term?: string | null;

  @IsOptional()
  @IsString()
  ref?: string | null;

  @IsOptional()
  @IsString()
  path?: string | null;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  capturedAt?: string;
}

export class CreateAttributionDto {
  /** Registration method: "email" | "google" | "apple" | "social". */
  @IsString()
  method: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttributionTouchDto)
  firstTouch?: AttributionTouchDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttributionTouchDto)
  lastTouch?: AttributionTouchDto | null;
}
