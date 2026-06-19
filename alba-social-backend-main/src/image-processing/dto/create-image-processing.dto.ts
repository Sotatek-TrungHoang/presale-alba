import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class CreateImageProcessingDto {
  @IsNotEmpty()
  @IsString()
  file: string; // Base64 encoded image string

  @IsNotEmpty()
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'])
  mimeType: string;
}
