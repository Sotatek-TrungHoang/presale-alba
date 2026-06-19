export class ResolveReportDto {
  status: 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
  moderationAction?: string;
}
