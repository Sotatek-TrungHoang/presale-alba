import { IsOptional, IsArray } from 'class-validator';
import { TimeSlot } from '@prisma/client';

export class AvailabilityDto {
  @IsOptional()
  @IsArray()
  weekdays?: TimeSlot[];

  @IsOptional()
  @IsArray()
  weekends?: TimeSlot[];
}
