import { Injectable } from '@nestjs/common';
import { CreateLeaderboardDto } from './dto/create-leaderboard.dto';
import { UpdateLeaderboardDto } from './dto/update-leaderboard.dto';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FindLeaderboardDto } from './dto/find-leaderboard.dto';

@Injectable()
export class LeaderboardsService {
  constructor(private prisma: PrismaService) {}

  create(createLeaderboardDto: CreateLeaderboardDto) {
    return 'This action adds a new leaderboard';
  }

  findAll() {
    return `This action returns all leaderboards`;
  }

  async findLeaderboard(
    findLeaderboardDto: FindLeaderboardDto,
  ): Promise<{ entries: LeaderboardEntryDto[] }> {
    const { groupId, courseId } = findLeaderboardDto;

    const where = {
      deleted_at: null,
      ...(groupId && { round: { post: { group_id: groupId } } }),
      ...(courseId && { round: { course_id: courseId } }),
    };

    const leaderboard = await this.prisma.playerScore.findMany({
      where,
      orderBy: [
        { againstPar: 'asc' },
        { total: 'asc' },
        { round: { date: 'desc' } },
      ],
      include: {
        user: {
          include: { profile: true },
        },
        round: {
          include: { course: true },
        },
      },
    });

    const entries: LeaderboardEntryDto[] = leaderboard.map((score, i) => ({
      rank: i + 1,
      userId: score.user_id,
      userName:
        score.user.profile?.first_name + ' ' + score.user.profile?.last_name ||
        'Unknown User',
      roundId: score.round_id,
      courseId: score.round.course_id,
      courseName: score.round.course.name,
      date: score.round.date,
      total: score.total,
      againstPar: score.againstPar,
    }));

    return { entries };
  }

  update(id: number, updateLeaderboardDto: UpdateLeaderboardDto) {
    return `This action updates a #${id} leaderboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} leaderboard`;
  }
}
