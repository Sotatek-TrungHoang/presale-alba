import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAttributionDto } from './dto/create-attribution.dto';

@Injectable()
export class AttributionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Record the signup attribution for the authenticated user. Resolves the
   * local User from the Firebase uid, then stores the first/last touch payloads.
   */
  async create(authId: string, dto: CreateAttributionDto) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId, deleted_at: null },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.attribution.create({
      data: {
        user_id: user.id,
        method: dto.method,
        first_touch: dto.firstTouch
          ? (dto.firstTouch as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        last_touch: dto.lastTouch
          ? (dto.lastTouch as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
  }

  /**
   * Record an anonymous click on a generic entrypoint link (GET /go).
   * Best-effort — never throws, so it can't block the page render.
   */
  async logClick(input: {
    query: Record<string, string | string[] | undefined>;
    userAgent?: string;
    referer?: string;
  }): Promise<void> {
    const q = input.query ?? {};
    const first = (value: string | string[] | undefined): string | null =>
      Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

    try {
      await this.prisma.linkClick.create({
        data: {
          source: first(q.utm_source),
          medium: first(q.utm_medium),
          campaign: first(q.utm_campaign),
          content: first(q.utm_content),
          term: first(q.utm_term),
          ref: first(q.ref),
          params: q as Prisma.InputJsonValue,
          user_agent: input.userAgent ?? null,
          referer: input.referer ?? null,
        },
      });
    } catch (error) {
      console.error('Failed to log link click:', error);
    }
  }
}
