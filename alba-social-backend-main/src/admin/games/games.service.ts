import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GameStatus,
  HandicapRange,
  InviteStatus,
  PlayerStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAdminGameDto } from './dto/update-admin-game.dto';
import { CreateAdminGameDto } from './dto/create-admin-game.dto';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class AdminGamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async updateGamePlayerStatus(
    gameId: string,
    userId: string,
    status: PlayerStatus,
  ) {
    const game = await this.prisma.game.findFirst({
      where: {
        id: gameId,
        deleted_at: null,
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const gamePlayer = await this.prisma.gamePlayer.findFirst({
      where: {
        game_id: gameId,
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!gamePlayer) {
      throw new NotFoundException('Player not found in this game');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.gamePlayer.update({
        where: {
          id: gamePlayer.id,
        },
        data: {
          status,
          has_approved: status === PlayerStatus.APPROVED,
        },
      });

      const approvedPlayersCurrent = await tx.gamePlayer.count({
        where: {
          game_id: gameId,
          status: PlayerStatus.APPROVED,
          deleted_at: null,
        },
      });

      const gameStatus =
        game.players_needed === approvedPlayersCurrent
          ? GameStatus.READY_TO_BOOK
          : GameStatus.PLAYERS_REQUIRED;

      await tx.game.update({
        where: { id: gameId },
        data: {
          players_current: approvedPlayersCurrent,
          status: gameStatus,
        },
      });
    });

    return this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
        course: true,
        group: true,
        players: {
          where: {
            deleted_at: null,
          },
          include: {
            user: {
              include: {
                profile: true,
                onboarding: true,
              },
            },
          },
        },
        conversation: {
          include: {
            participants: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            messages: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
              orderBy: {
                created_at: 'asc',
              },
            },
          },
        },
      },
    });
  }

  async notifyNearbyUsers(gameId: string, userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds || [])];

    if (uniqueUserIds.length === 0) {
      throw new BadRequestException('At least one user must be provided');
    }

    const game = await this.prisma.game.findFirst({
      where: {
        id: gameId,
        deleted_at: null,
      },
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
        course: true,
        players: {
          where: {
            deleted_at: null,
          },
          select: {
            user_id: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const existingPlayerIds = new Set(game.players.map((player) => player.user_id));

    const hasExistingPlayers = uniqueUserIds.some((userId) =>
      existingPlayerIds.has(userId),
    );

    if (hasExistingPlayers) {
      throw new BadRequestException(
        'Some selected users are already part of the game',
      );
    }

    const organiser =
      game.creator.profile?.first_name || game.creator.email || 'the organiser';
    const gameTitle = game.course?.name || game.location || 'golf round';
    const gameDate = game.date.toLocaleDateString('en-GB');

    const notification = this.notificationsService.createGameNearbyNotification(
      gameId,
      organiser,
      gameTitle,
      gameDate,
    );

    await Promise.all(
      uniqueUserIds.map((userId) =>
        this.notificationsService.sendNotificationToUser(userId, notification),
      ),
    );

    return {
      success: true,
      notifiedCount: uniqueUserIds.length,
      notifiedUserIds: uniqueUserIds,
    };
  }

  async createGame(authId: string, createAdminGameDto: CreateAdminGameDto) {
    if (createAdminGameDto.players_needed <= 2) {
      throw new BadRequestException('players_needed must be greater than 2');
    }

    const creator = await this.prisma.user.findFirst({
      where: {
        auth_id: authId,
        deleted_at: null,
      },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    if (createAdminGameDto.course_id) {
      const course = await this.prisma.golfCourse.findFirst({
        where: {
          id: createAdminGameDto.course_id,
          deleted_at: null,
        },
      });

      if (!course) {
        throw new NotFoundException('Course not found');
      }
    }

    return this.prisma.game.create({
      data: {
        creator: { connect: { id: creator.id } },
        date: new Date(createAdminGameDto.date),
        time_slot: createAdminGameDto.time_slot,
        exact_time: createAdminGameDto.exact_time,
        players_current: 0,
        players_needed: createAdminGameDto.players_needed,
        initial_players_needed: createAdminGameDto.players_needed,
        course: createAdminGameDto.course_id
          ? { connect: { id: createAdminGameDto.course_id } }
          : undefined,
        game_type: createAdminGameDto.game_type,
        game_format: createAdminGameDto.game_format,
        organiser_handicap: HandicapRange.DONT_KNOW,
        status: GameStatus.PLAYERS_REQUIRED,
      },
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
        course: true,
        players: {
          where: {
            deleted_at: null,
          },
          include: {
            user: {
              include: {
                profile: true,
                onboarding: true,
              },
            },
          },
        },
      },
    });
  }

  async removePlayerFromGame(gameId: string, userId: string) {
    const game = await this.prisma.game.findFirst({
      where: {
        id: gameId,
        deleted_at: null,
      },
      include: {
        conversation: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const gamePlayer = await this.prisma.gamePlayer.findFirst({
      where: {
        game_id: gameId,
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!gamePlayer) {
      throw new NotFoundException('Player not found in this game');
    }

    if (gamePlayer.has_paid) {
      throw new ConflictException('Paid players cannot be removed from a game');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.gamePlayer.update({
        where: {
          id: gamePlayer.id,
        },
        data: {
          status: PlayerStatus.REJECTED,
          has_approved: false,
          deleted_at: new Date(),
        },
      });

      if (game.conversation?.id) {
        await tx.conversationParticipant.updateMany({
          where: {
            conversation_id: game.conversation.id,
            user_id: userId,
            deleted_at: null,
          },
          data: {
            deleted_at: new Date(),
          },
        });
      }

      const approvedPlayersCurrent = await tx.gamePlayer.count({
        where: {
          game_id: gameId,
          status: PlayerStatus.APPROVED,
          deleted_at: null,
        },
      });

      const status =
        game.players_needed === approvedPlayersCurrent
          ? GameStatus.READY_TO_BOOK
          : GameStatus.PLAYERS_REQUIRED;

      await tx.game.update({
        where: {
          id: gameId,
        },
        data: {
          players_current: approvedPlayersCurrent,
          status,
        },
      });
    });

    return this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
        course: true,
        group: true,
        players: {
          where: {
            deleted_at: null,
          },
          include: {
            user: {
              include: {
                profile: true,
                onboarding: true,
              },
            },
          },
        },
        conversation: {
          include: {
            participants: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            messages: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
              orderBy: {
                created_at: 'asc',
              },
            },
          },
        },
      },
    });
  }

  async addPlayerToGame(gameId: string, userId: string) {
    const game = await this.prisma.game.findFirst({
      where: {
        id: gameId,
        deleted_at: null,
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deleted_at: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingGamePlayer = await this.prisma.gamePlayer.findFirst({
      where: {
        game_id: gameId,
        user_id: userId,
      },
    });

    if (existingGamePlayer) {
      if (existingGamePlayer.deleted_at === null) {
        throw new ConflictException('User is already in this game');
      }

      await this.prisma.gamePlayer.update({
        where: {
          id: existingGamePlayer.id,
        },
        data: {
          status: PlayerStatus.PENDING,
          invite_status: InviteStatus.NOT_INVITED,
          has_approved: false,
          deleted_at: null,
        },
      });
    } else {
      await this.prisma.gamePlayer.create({
        data: {
          game_id: gameId,
          user_id: userId,
          status: PlayerStatus.PENDING,
          invite_status: InviteStatus.NOT_INVITED,
          has_approved: false,
        },
      });
    }

    return this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
        course: true,
        group: true,
        players: {
          where: {
            deleted_at: null,
          },
          include: {
            user: {
              include: {
                profile: true,
                onboarding: true,
              },
            },
          },
        },
        conversation: {
          include: {
            participants: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            messages: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
              orderBy: {
                created_at: 'asc',
              },
            },
          },
        },
      },
    });
  }

  async updateGame(id: string, updateAdminGameDto: UpdateAdminGameDto) {
    const existingGame = await this.prisma.game.findUnique({
      where: { id },
    });

    if (!existingGame) {
      throw new NotFoundException('Game not found');
    }

    if (updateAdminGameDto.creator_id !== undefined) {
      const creator = await this.prisma.user.findFirst({
        where: { id: updateAdminGameDto.creator_id, deleted_at: null },
      });

      if (!creator) {
        throw new NotFoundException('Creator not found');
      }
    }

    if (updateAdminGameDto.course_id !== undefined && updateAdminGameDto.course_id !== null) {
      const course = await this.prisma.golfCourse.findFirst({
        where: { id: updateAdminGameDto.course_id, deleted_at: null },
      });

      if (!course) {
        throw new NotFoundException('Course not found');
      }
    }

    if (updateAdminGameDto.group_id !== undefined && updateAdminGameDto.group_id !== null) {
      const group = await this.prisma.group.findFirst({
        where: { id: updateAdminGameDto.group_id, deleted_at: null },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }
    }

    const approvedPlayersCurrent = await this.prisma.gamePlayer.count({
      where: {
        game_id: id,
        status: PlayerStatus.APPROVED,
        deleted_at: null,
      },
    });

    const finalPlayersCurrent = approvedPlayersCurrent;
    const finalPlayersNeeded =
      updateAdminGameDto.players_needed ?? existingGame.players_needed;

    if (finalPlayersNeeded < 1) {
      throw new BadRequestException('players_needed must be at least 1');
    }

    if (finalPlayersCurrent > finalPlayersNeeded) {
      throw new BadRequestException(
        'players_current cannot be greater than players_needed',
      );
    }

    const updateData: Prisma.GameUpdateInput = {};

    if (updateAdminGameDto.creator_id !== undefined) {
      updateData.creator = {
        connect: { id: updateAdminGameDto.creator_id },
      };
    }
    if (updateAdminGameDto.date !== undefined) {
      updateData.date = new Date(updateAdminGameDto.date);
    }
    if (updateAdminGameDto.time_slot !== undefined) {
      updateData.time_slot = updateAdminGameDto.time_slot;
    }
    if (updateAdminGameDto.exact_time !== undefined) {
      updateData.exact_time = updateAdminGameDto.exact_time;
    }
    updateData.players_current = approvedPlayersCurrent;
    if (updateAdminGameDto.players_needed !== undefined) {
      updateData.players_needed = updateAdminGameDto.players_needed;
    }
    updateData.status =
      finalPlayersNeeded === finalPlayersCurrent
        ? GameStatus.READY_TO_BOOK
        : GameStatus.PLAYERS_REQUIRED;
    if (updateAdminGameDto.course_id !== undefined) {
      updateData.course =
        updateAdminGameDto.course_id === null
          ? { disconnect: true }
          : { connect: { id: updateAdminGameDto.course_id } };
    }
    if (updateAdminGameDto.group_id !== undefined) {
      updateData.group =
        updateAdminGameDto.group_id === null
          ? { disconnect: true }
          : { connect: { id: updateAdminGameDto.group_id } };
    }
    if (updateAdminGameDto.handicap_min !== undefined) {
      updateData.handicap_min = updateAdminGameDto.handicap_min;
    }
    if (updateAdminGameDto.handicap_max !== undefined) {
      updateData.handicap_max = updateAdminGameDto.handicap_max;
    }
    if (updateAdminGameDto.game_type !== undefined) {
      updateData.game_type = updateAdminGameDto.game_type;
    }
    if (updateAdminGameDto.game_format !== undefined) {
      updateData.game_format = updateAdminGameDto.game_format;
    }
    if (updateAdminGameDto.stripe_session_id !== undefined) {
      updateData.stripe_session_id = updateAdminGameDto.stripe_session_id;
    }
    if (updateAdminGameDto.deleted !== undefined) {
      updateData.deleted_at = updateAdminGameDto.deleted ? new Date() : null;
    }

    return this.prisma.game.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
        course: true,
        group: true,
        players: {
          where: {
            deleted_at: null,
          },
          include: {
            user: {
              include: {
                profile: true,
                onboarding: true,
              },
            },
          },
        },
        conversation: {
          include: {
            participants: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            messages: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
              orderBy: {
                created_at: 'asc',
              },
            },
          },
        },
      },
    });
  }

  async deleteGame(id: string) {
    const existingGame = await this.prisma.game.findFirst({
      where: {
        id,
        deleted_at: null,
      },
    });

    if (!existingGame) {
      throw new NotFoundException('Game not found');
    }

    return this.prisma.game.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
      include: {
        creator: {
          include: {
            profile: true,
          },
        },
        course: true,
        group: true,
        players: {
          where: {
            deleted_at: null,
          },
          include: {
            user: {
              include: {
                profile: true,
                onboarding: true,
              },
            },
          },
        },
        conversation: {
          include: {
            participants: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            messages: {
              where: {
                deleted_at: null,
              },
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
              orderBy: {
                created_at: 'asc',
              },
            },
          },
        },
      },
    });
  }
}