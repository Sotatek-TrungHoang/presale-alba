import { IsString } from 'class-validator';

export class GetPresignedUrlDto {
  @IsString()
  fileName: string;

  @IsString()
  fileType: string;
}
