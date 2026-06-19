import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  async block(authId: string, blockedUserId: string) {
    const me = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!me) throw new NotFoundException('User not found');
    if (me.id === blockedUserId) return;

    return this.prisma.block.upsert({
      where: {
        blocker_id_blocked_id: { blocker_id: me.id, blocked_id: blockedUserId },
      },
      update: { deleted_at: null },
      create: { blocker_id: me.id, blocked_id: blockedUserId },
    });
  }

  async unblock(authId: string, blockedUserId: string) {
    const me = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!me) throw new NotFoundException('User not found');
    await this.prisma.block
      .update({
        where: {
          blocker_id_blocked_id: {
            blocker_id: me.id,
            blocked_id: blockedUserId,
          },
        },
        data: { deleted_at: new Date() },
      })
      .catch(() => undefined);
  }

  async list(authId: string) {
    const me = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!me) throw new NotFoundException('User not found');
    return this.prisma.block.findMany({
      where: { blocker_id: me.id, deleted_at: null },
      include: { blocked: { include: { profile: true } } },
    });
  }
}
