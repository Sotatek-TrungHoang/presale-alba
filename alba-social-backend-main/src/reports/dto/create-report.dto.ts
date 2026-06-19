export class CreateReportDto {
  targetType: 'USER' | 'CONVERSATION' | 'GAME';
  targetId: string;
  reason: 'SPAM' | 'HARASSMENT' | 'HATE_SPEECH' | 'NSFW' | 'SCAM' | 'OTHER';
  description?: string;
}
