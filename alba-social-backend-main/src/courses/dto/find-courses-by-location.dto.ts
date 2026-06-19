import { IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FindCoursesByLocationDto {
  @IsNumber()
  @Type(() => Number)
  lng: number;

  @IsNumber()
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  radius: number = 50;
}
