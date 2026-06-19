import { IsOptional, IsString } from 'class-validator';

export class getOrCreateConversationDto {
  @IsString()
  @IsOptional()
  profileId: string;

  @IsString()
  @IsOptional()
  gameId: string;
}
