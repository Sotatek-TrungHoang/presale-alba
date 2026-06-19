import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdminCourseHoleDto {
  @ApiPropertyOptional({
    description: 'Hole ID (required for updating an existing hole)',
    example: '949348d1-8b7a-4109-a263-0f3383016aee',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'Hole number', example: 1 })
  @IsOptional()
  @IsNumber()
  number?: number;

  @ApiPropertyOptional({ description: 'Hole yardage', example: 413 })
  @IsOptional()
  @IsNumber()
  yards?: number;

  @ApiPropertyOptional({ description: 'Par value', example: 4 })
  @IsOptional()
  @IsNumber()
  par?: number;

  @ApiPropertyOptional({ description: 'Handicap index', example: 5 })
  @IsOptional()
  @IsNumber()
  handicap?: number;

  @ApiPropertyOptional({
    description: 'Soft delete or restore the hole',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}

export class UpdateAdminCourseTeeDto {
  @ApiPropertyOptional({
    description: 'Tee ID (required for updating an existing tee)',
    example: 'd6da125c-fe0e-4e5f-a0dd-fad117f56b87',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'Tee name', example: 'Yellow' })
  @IsOptional()
  @IsString()
  tee_name?: string;

  @ApiPropertyOptional({ description: 'Course rating', example: 72.2 })
  @IsOptional()
  @IsNumber()
  rating?: number;

  @ApiPropertyOptional({ description: 'Slope rating', example: 139 })
  @IsOptional()
  @IsNumber()
  slope?: number;

  @ApiPropertyOptional({ type: [UpdateAdminCourseHoleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminCourseHoleDto)
  holes?: UpdateAdminCourseHoleDto[];

  @ApiPropertyOptional({
    description: 'Soft delete or restore the tee',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}

export class UpdateAdminCourseDto {
  @ApiPropertyOptional({
    description: 'Course name',
    example: 'Royal Liverpool Golf Club',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Latitude', example: 53.3871869 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: -3.1839592 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({
    description: 'Course address',
    example: 'Meols Drive, Hoylake, Wirral, Merseyside, CH47 4AL',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Saturday 9am cost in pence',
    example: 25000,
  })
  @IsOptional()
  @IsNumber()
  saturday_9am_cost_pence?: number;

  @ApiPropertyOptional({ description: 'Is the course bookable', example: true })
  @IsOptional()
  @IsBoolean()
  is_bookable?: boolean;

  @ApiPropertyOptional({ description: 'Course closed down', example: false })
  @IsOptional()
  @IsBoolean()
  closed_down?: boolean;

  @ApiPropertyOptional({
    description: 'Booking URL',
    example: 'https://www.royal-liverpool-golf.com/Visitor-Tee-Booking',
  })
  @IsOptional()
  @IsString()
  booking_url?: string;

  @ApiPropertyOptional({ type: [UpdateAdminCourseTeeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminCourseTeeDto)
  tees?: UpdateAdminCourseTeeDto[];

  @ApiPropertyOptional({
    description: 'Soft delete or restore the course',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}
