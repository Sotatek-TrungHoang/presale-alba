import { PartialType } from '@nestjs/swagger';
import { CreateImageProcessingDto } from './create-image-processing.dto';

export class UpdateImageProcessingDto extends PartialType(
  CreateImageProcessingDto,
) {}
