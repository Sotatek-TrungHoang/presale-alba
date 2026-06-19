import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateAdminCourseDto {
  @ApiProperty({
    description: 'Course name',
    example: 'Royal Liverpool Golf Club',
  })
  @IsString()
  name: string;

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
}
