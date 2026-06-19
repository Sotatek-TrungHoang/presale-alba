import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetGameAnalyticsQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return 30;
    if (value === 'all') return 'all';
    return Number(value);
  })
  @IsIn([7, 30, 90, 'all'])
  days: 7 | 30 | 90 | 'all' = 30;

  @IsOptional()
  @IsString()
  courseId?: string;
}
