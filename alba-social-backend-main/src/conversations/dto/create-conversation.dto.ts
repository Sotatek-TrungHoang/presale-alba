import { IsString, IsArray, IsEnum } from 'class-validator';
import { ConversationType } from '@prisma/client';

export class CreateConversationDto {
  @IsString()
  name?: string;

  @IsEnum(ConversationType)
  type: ConversationType;

  @IsArray()
  @IsString({ each: true })
  participantIds: string[];
}
