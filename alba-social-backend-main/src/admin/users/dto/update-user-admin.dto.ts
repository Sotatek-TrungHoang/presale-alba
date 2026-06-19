import { IsOptional, IsBoolean, IsString, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserAdminDto {
  @ApiPropertyOptional({
    description: 'Update user admin status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  admin_status?: boolean;

  @ApiPropertyOptional({
    description: 'First name in profile',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Last name in profile',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'User address in profile',
    example: '123 Golf Street, London',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'User handicap in profile',
    example: 12.5,
  })
  @IsOptional()
  handicap?: number;
}
