import { IsOptional, IsString } from 'class-validator';

export class FindLeaderboardDto {
  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  // Uncomment these when you're ready to implement pagination and time filtering
  // @IsOptional()
  // @IsEnum(['all', 'day', 'week', 'month', 'year'])
  // timeFilter?: 'all' | 'day' | 'week' | 'month' | 'year' = 'all';

  // @IsOptional()
  // @IsInt()
  // @Min(1)
  // page?: number = 1;

  // @IsOptional()
  // @IsInt()
  // @Min(1)
  // pageSize?: number = 10;
}
