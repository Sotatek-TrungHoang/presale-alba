import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async create(authId: string, dto: CreateReportDto) {
    const me = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!me) throw new NotFoundException('User not found');

    // Validate target exists
    switch (dto.targetType) {
      case 'USER':
        if (
          !(await this.prisma.user.findUnique({ where: { id: dto.targetId } }))
        )
          throw new NotFoundException('Target user not found');
        break;
      case 'CONVERSATION':
        if (
          !(await this.prisma.conversation.findUnique({
            where: { id: dto.targetId },
          }))
        )
          throw new NotFoundException('Conversation not found');
        break;
      case 'GAME':
        if (
          !(await this.prisma.game.findUnique({ where: { id: dto.targetId } }))
        )
          throw new NotFoundException('Game not found');
        break;
    }

    const data: any = {
      reporter_id: me.id,
      target_type: dto.targetType,
      reason: dto.reason,
      description: dto.description,
    };

    if (dto.targetType === 'USER') data.target_user_id = dto.targetId;
    if (dto.targetType === 'CONVERSATION')
      data.target_conversation_id = dto.targetId;
    if (dto.targetType === 'GAME') data.target_game_id = dto.targetId;

    return this.prisma.report.create({ data });
  }

  async list(
    authId: string,
    status?: 'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED',
  ) {
    const admin = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!admin || !admin.admin_status)
      throw new ForbiddenException('Admin only');

    return this.prisma.report.findMany({
      where: { deleted_at: null, ...(status ? { status } : {}) },
      orderBy: { created_at: 'desc' },
    });
  }

  async resolve(authId: string, reportId: string, dto: ResolveReportDto) {
    const admin = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!admin || !admin.admin_status)
      throw new ForbiddenException('Admin only');

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Report not found');

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status: dto.status, moderation_action: dto.moderationAction },
    });
  }
}
