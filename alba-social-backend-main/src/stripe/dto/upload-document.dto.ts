import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  // Which side of the ID this file is. Stripe stores front/back separately
  // under individual.verification.document.
  @IsIn(['front', 'back'])
  side: 'front' | 'back';

  // Optional: 'additional_document' to attach to
  // individual.verification.additional_document instead of the main document
  // slot. Default 'document'.
  @IsOptional()
  @IsIn(['document', 'additional_document'])
  slot?: 'document' | 'additional_document';

  @IsString()
  @IsNotEmpty()
  file_name: string;
}
