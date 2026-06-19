import { IsString, IsNotEmpty } from 'class-validator';

export class AddConditionReportDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  condition: string;

  @IsString()
  details: string;
}
