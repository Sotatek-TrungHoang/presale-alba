import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JoinGameDto } from './dto/join-game.dto';
import { UpdatePlayerStatusDto } from './dto/update-player-status.dto';
import { UpdateGameStatusDto } from './dto/update-game-status.dto';
import {
  PaginateGamesDto,
  type AdminGameStatusFilter,
} from './dto/pagination-games.dto';
import {
  InviteStatus,
  PlayerStatus,
  GameStatus,
  Game,
  ComplaintStatus,
} from '@prisma/client';
import { StripeService } from 'src/stripe/stripe.service';
import { SuggestionStrategy } from './suggestion.strategy';
import { NotificationsService } from '../notifications/notifications.service';
import { reportNotificationFailure } from '../notifications/notification-error';

@Injectable()
export class GamesService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private notificationsService: NotificationsService,
  ) {}

  async createGame(authId: string, createGameDto: CreateGameDto) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const initialPlayersCurrent = 1; // Creator is the first approved player

    if (createGameDto.players_needed < 1) {
      throw new ConflictException('Players needed must be at least 1.');
    }

    // Correctly typed initial player data for the creator
    const creatorPlayerData: {
      user: { connect: { id: string } };
      status: PlayerStatus;
      has_approved: boolean;
      invite_status: InviteStatus;
    } = {
      user: { connect: { id: user.id } },
      status: PlayerStatus.APPROVED,
      has_approved: true,
      invite_status: InviteStatus.NOT_INVITED,
    };

    const initialPlayersForDbCreate = [creatorPlayerData];

    if (createGameDto.invited_users && createGameDto.invited_users.length > 0) {
      const invitedPlayersData = createGameDto.invited_users.map((userId) => ({
        user: { connect: { id: userId } },
        status: PlayerStatus.INVITED,
        has_approved: false,
        invite_status: InviteStatus.PENDING,
      }));
      initialPlayersForDbCreate.push(...invitedPlayersData);
    }

    const conversationParticipants = [
      {
        user: { connect: { id: user.id } },
      },
    ];

    let initialGameStatus: GameStatus = GameStatus.PLAYERS_REQUIRED;
    if (initialPlayersCurrent >= createGameDto.players_needed) {
      initialGameStatus = GameStatus.READY_TO_BOOK;
    }

    const game = await this.prisma.game.create({
      data: {
        creator: { connect: { id: user.id } },
        course: createGameDto.course_id
          ? { connect: { id: createGameDto.course_id } }
          : undefined,
        group: createGameDto.group_id
          ? { connect: { id: createGameDto.group_id } }
          : undefined,
        date: createGameDto.date,
        time_slot: createGameDto.time_slot,
        exact_time: createGameDto.exact_time,
        players_current: initialPlayersCurrent,
        players_needed: createGameDto.players_needed,
        initial_players_needed: createGameDto.players_needed,
        handicap_min: createGameDto.handicap_min,
        handicap_max: createGameDto.handicap_max,
        location: createGameDto.location,
        lat: createGameDto.lat,
        lng: createGameDto.lng,
        distance: createGameDto.distance,
        game_type: createGameDto.game_type,
        game_format: createGameDto.game_format,
        organiser_handicap: createGameDto.organiser_handicap,
        total_cost: createGameDto.total_cost,
        cost_per_player: createGameDto.cost_per_player,
        status: initialGameStatus,
        players: {
          create: initialPlayersForDbCreate, // Use the correctly typed array
        },
        conversation: {
          create: {
            type: 'GAME',
            participants: {
              create: conversationParticipants,
            },
          },
        },
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
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        conversation: true,
      },
    });

    // NOTIFICATION: Send invitations to invited users
    if (createGameDto.invited_users && createGameDto.invited_users.length > 0) {
      const inviterName = user.profile?.first_name || 'Someone';

      for (const invitedUserId of createGameDto.invited_users) {
        try {
          const inviteNotification =
            this.notificationsService.createGameInviteNotification(
              game.id,
              inviterName,
            );

          await this.notificationsService.sendNotificationToUser(
            invitedUserId,
            inviteNotification,
          );
        } catch (error) {
          // Log error but don't fail game creation
          console.error(
            `Failed to send invitation notification to user ${invitedUserId}:`,
            error,
          );
        }
      }
    }

    return game;
  }

  async respondToInvitation(
    authId: string,
    gameId: string,
    userId: string,
    response: 'ACCEPTED' | 'DECLINED',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id !== userId) {
      throw new ForbiddenException('User ID does not match authenticated user');
    }

    const gamePlayer = await this.prisma.gamePlayer.findFirst({
      where: {
        game_id: gameId,
        user_id: userId,
        status: PlayerStatus.INVITED,
        invite_status: InviteStatus.PENDING,
      },
      include: {
        game: {
          include: {
            conversation: true,
            course: true,
          },
        },
      },
    });

    if (!gamePlayer || !gamePlayer.game) {
      throw new NotFoundException(
        'Invitation not found or player not in a state to respond.',
      );
    }

    const game = gamePlayer.game;

    if (response === 'DECLINED') {
      await this.prisma.gamePlayer.update({
        where: { id: gamePlayer.id },
        data: {
          status: PlayerStatus.REJECTED,
          invite_status: InviteStatus.DECLINED,
          deleted_at: new Date(),
        },
      });
    } else {
      await this.prisma.gamePlayer.update({
        where: { id: gamePlayer.id },
        data: {
          status: PlayerStatus.APPROVED,
          invite_status: InviteStatus.ACCEPTED,
        },
      });

      const updatedGame = await this.prisma.game.update({
        where: { id: gameId },
        data: {
          players_current: { increment: 1 },
        },
      });

      if (
        updatedGame.players_current >= updatedGame.players_needed &&
        updatedGame.status === GameStatus.PLAYERS_REQUIRED
      ) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: { status: GameStatus.READY_TO_BOOK },
        });
      }

      if (game.conversation) {
        const existingParticipant =
          await this.prisma.conversationParticipant.findFirst({
            where: {
              conversation_id: game.conversation.id,
              user_id: userId,
              deleted_at: null,
            },
          });

        if (!existingParticipant) {
          await this.prisma.conversationParticipant.create({
            data: {
              conversation_id: game.conversation.id,
              user_id: userId,
            },
          });

          // NOTIFICATION: Notify player they've been added to game chat
          // try {
          //   const gameLocation =
          //     game.course?.name || game.location || 'the game';
          //   const addedToChatNotification =
          //     this.notificationsService.createAddedToGameChatNotification(
          //       game.conversation.id,
          //       gameLocation,
          //     );
          //   await this.notificationsService.sendNotificationToUser(
          //     userId,
          //     addedToChatNotification,
          //   );
          // } catch (error) {
          //   console.error('Failed to send added to chat notification:', error);
          // }
        }
      }
    }

    // NOTIFICATION: Notify game creator about invitation response
    try {
      const responder = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
        },
      });

      if (responder) {
        const responderName = responder.profile?.first_name || 'Someone';
        const gameLocation = game.course?.name || game.location || 'your game';

        if (response === 'ACCEPTED') {
          const acceptedNotification =
            this.notificationsService.createInvitationAcceptedNotification(
              gameId,
              responderName,
              gameLocation,
            );
          await this.notificationsService.sendNotificationToUser(
            game.creator_id,
            acceptedNotification,
          );

          // Check if game became READY_TO_BOOK and notify all players
          const finalGame = await this.findOne(gameId);
          if (finalGame.status === GameStatus.READY_TO_BOOK) {
            await this.notifyGameReadyToBook(finalGame);
          }
        } else {
          const declinedNotification =
            this.notificationsService.createInvitationDeclinedNotification(
              gameId,
              responderName,
              gameLocation,
            );
          await this.notificationsService.sendNotificationToUser(
            game.creator_id,
            declinedNotification,
          );
        }
      }
    } catch (error) {
      reportNotificationFailure('invitation response notification', error);
    }

    return this.findOne(gameId);
  }

  async joinGame(authId: string, joinGameDto: JoinGameDto) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: joinGameDto.gameId },
      include: {
        players: {
          where: { deleted_at: null }, // Fetch all active (not soft-deleted) players
        },
        course: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Game must be looking for players.
    // If it's READY_TO_BOOK, it means enough approved players are in, but organizer might still manage pending requests.
    // If it's READY or COMPLETED or CANCELLED, no new players can join.
    if (
      game.status !== GameStatus.PLAYERS_REQUIRED &&
      game.status !== GameStatus.READY_TO_BOOK
    ) {
      throw new ConflictException(
        'Game is not currently accepting new player requests.',
      );
    }

    // Check if user is already a player (approved, pending, or invited and not declined)
    const isAlreadyPlayer = game.players.some(
      (p) => p.user_id === user.id && p.status !== PlayerStatus.REJECTED, // REJECTED players might try to rejoin if allowed.
    );
    if (isAlreadyPlayer) {
      throw new ConflictException('User is already involved in this game.');
    }

    // Note: We are NOT checking if game.players_current >= game.players_needed here before allowing a join request.
    // This allows users to request to join even if the game has enough *approved* players,
    // giving the organizer choice. The organizer will not be able to *approve* more than players_needed.

    const updatedGame = await this.prisma.game.update({
      where: { id: game.id },
      data: {
        players: {
          create: {
            user: { connect: { id: user.id } },
            status: PlayerStatus.PENDING,
            invite_status: InviteStatus.NOT_INVITED,
            has_approved: false, // Not approved yet
          },
        },
        // players_current is NOT incremented here.
        // Game status does not change here; it changes when players are approved.
      },
      include: {
        creator: { include: { profile: true } },
        course: true,
        group: true,
        players: {
          where: { deleted_at: null },
          include: { user: { include: { profile: true } } },
        },
      },
    });

    // NOTIFICATION: Notify game creator about join request
    try {
      const joinerName = user.profile?.first_name || 'Someone';
      const gameLocation = game.course?.name || game.location || 'your game';
      const joinRequestNotification =
        this.notificationsService.createJoinRequestNotification(
          game.id,
          joinerName,
          gameLocation,
        );

      await this.notificationsService.sendNotificationToUser(
        game.creator_id,
        joinRequestNotification,
      );
    } catch (error) {
      // Log error but don't fail join operation
      reportNotificationFailure('join request notification', error);
    }

    return updatedGame;
  }

  async updatePlayerStatus(
    gameId: string,
    targetPlayerId: string,
    authId: string,
    dto: UpdatePlayerStatusDto,
  ) {
    const authenticatedUser = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!authenticatedUser) {
      throw new NotFoundException('Authenticated user not found');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: { where: { deleted_at: null } },
        course: true,
        conversation: {
          include: { participants: { where: { deleted_at: null } } },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.creator_id !== authenticatedUser.id) {
      throw new ForbiddenException(
        'Only the game creator can approve or reject players.',
      );
    }

    const playerToUpdate = game.players.find(
      (p) => p.user_id === targetPlayerId,
    );
    if (!playerToUpdate) {
      throw new NotFoundException('Player not found in this game.');
    }

    if (playerToUpdate.status !== PlayerStatus.PENDING) {
      throw new ConflictException(
        'Player is not in a PENDING state. Current status: ' +
          playerToUpdate.status,
      );
    }

    if (dto.status === PlayerStatus.REJECTED) {
      await this.prisma.$transaction([
        this.prisma.gamePlayer.update({
          where: { id: playerToUpdate.id },
          data: {
            status: PlayerStatus.REJECTED,
            deleted_at: new Date(),
          },
        }),
        this.prisma.conversationParticipant.updateMany({
          where: {
            conversation_id: game.conversation?.id,
            user_id: targetPlayerId,
            deleted_at: null,
          },
          data: {
            deleted_at: new Date(),
          },
        }),
      ]);
    } else if (dto.status === PlayerStatus.APPROVED) {
      if (game.players_current >= game.players_needed) {
        throw new ConflictException(
          'Cannot approve player. Game already has the required number of approved players.',
        );
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.gamePlayer.update({
          where: { id: playerToUpdate.id },
          data: {
            status: PlayerStatus.APPROVED,
            has_approved: true,
          },
        });

        const updatedGame = await tx.game.update({
          where: { id: gameId },
          data: { players_current: { increment: 1 } },
        });

        if (game.conversation) {
          const existingParticipant = game.conversation.participants.find(
            (p) => p.user_id === targetPlayerId && !p.deleted_at,
          );
          if (!existingParticipant) {
            await tx.conversationParticipant.create({
              data: {
                conversation_id: game.conversation.id,
                user_id: targetPlayerId,
              },
            });

            // NOTIFICATION: Notify player they've been added to game chat
            try {
              const gameLocation =
                game.course?.name || game.location || 'the game';
              const addedToChatNotification =
                this.notificationsService.createAddedToGameChatNotification(
                  game.conversation.id,
                  gameLocation,
                );
              await this.notificationsService.sendNotificationToUser(
                targetPlayerId,
                addedToChatNotification,
              );
            } catch (error) {
              console.error(
                'Failed to send added to chat notification:',
                error,
              );
            }
          }
        }

        if (
          updatedGame.players_current >= updatedGame.players_needed &&
          updatedGame.status === GameStatus.PLAYERS_REQUIRED
        ) {
          await tx.game.update({
            where: { id: gameId },
            data: { status: GameStatus.READY_TO_BOOK },
          });
        }
      });
    }

    // NOTIFICATION: Notify player about status change
    try {
      const gameLocation = game.course?.name || game.location || 'the game';

      if (dto.status === PlayerStatus.APPROVED) {
        const approvalNotification =
          this.notificationsService.createPlayerApprovedNotification(
            gameId,
            gameLocation,
          );
        await this.notificationsService.sendNotificationToUser(
          targetPlayerId,
          approvalNotification,
        );

        // Check if game became READY_TO_BOOK and notify all players
        const finalGame = await this.findOne(gameId);
        if (finalGame.status === GameStatus.READY_TO_BOOK) {
          await this.notifyGameReadyToBook(finalGame);
        }
      } else if (dto.status === PlayerStatus.REJECTED) {
        const rejectionNotification =
          this.notificationsService.createPlayerRejectedNotification(
            gameId,
            gameLocation,
          );
        await this.notificationsService.sendNotificationToUser(
          targetPlayerId,
          rejectionNotification,
        );
      }
    } catch (error) {
      // Log error but don't fail the operation
      reportNotificationFailure('player status notification', error);
    }

    return this.findOne(gameId);
  }

  async confirmGameDetails(
    gameId: string,
    authId: string,
    dto: UpdateGameStatusDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          where: { deleted_at: null },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.creator_id !== user.id) {
      throw new ForbiddenException('Only the creator can confirm game details');
    }

    // Game must be in READY_TO_BOOK status to be confirmed by the organizer
    if (game.status !== GameStatus.READY_TO_BOOK) {
      throw new ConflictException(
        `Game must be in READY_TO_BOOK status to confirm details. Current status: ${game.status}`,
      );
    }

    // Find creator's player record to ensure their status is APPROVED
    const creatorPlayer = game.players.find(
      (p) => p.user_id === game.creator_id,
    );
    if (!creatorPlayer) {
      // This should ideally not happen if creator is always added as an APPROVED player
      throw new ConflictException(
        'Creator player record not found. Cannot confirm game.',
      );
    }
    // Ensure creator's status is APPROVED (it should be from game creation)
    if (creatorPlayer.status !== PlayerStatus.APPROVED) {
      await this.prisma.gamePlayer.update({
        where: { id: creatorPlayer.id },
        data: { status: PlayerStatus.APPROVED, has_approved: true }, // Ensure it's set
      });
    }
    // Ensure the organiser is marked as paid (zero-amount) so that payout logic can succeed
    if (!creatorPlayer.has_paid) {
      await this.prisma.gamePlayer.update({
        where: { id: creatorPlayer.id },
        data: {
          has_paid: true,
          payment_amount: 0,
          payment_date: new Date(),
        },
      });
    }

    // Prepare updated game data
    const updatedGameData: Partial<Game> & { status?: GameStatus } = {
      course_id: dto.course_id || game.course_id,
      date: dto.date || game.date,
      time_slot: dto.time_slot || game.time_slot,
      exact_time: dto.exact_time || game.exact_time,
      total_cost:
        dto.total_cost !== undefined ? dto.total_cost : game.total_cost,
      // cost_per_player will be calculated or taken from DTO
    };

    let finalCostPerPlayer =
      dto.cost_per_player !== undefined
        ? dto.cost_per_player
        : game.cost_per_player;

    if (
      updatedGameData.total_cost !== null &&
      updatedGameData.total_cost !== undefined &&
      game.players_needed > 0
    ) {
      if (dto.cost_per_player === undefined && game.cost_per_player === null) {
        // Only calculate if not provided and not already set
        finalCostPerPlayer = Math.ceil(
          updatedGameData.total_cost / game.players_needed,
        );
      }
    }
    updatedGameData.cost_per_player = finalCostPerPlayer;

    // Check if all required fields for READY status are present
    const canTransitionToReady =
      updatedGameData.exact_time !== null &&
      updatedGameData.exact_time !== undefined &&
      updatedGameData.total_cost !== null &&
      updatedGameData.total_cost !== undefined &&
      updatedGameData.cost_per_player !== null &&
      updatedGameData.cost_per_player !== undefined;

    if (canTransitionToReady) {
      updatedGameData.status = GameStatus.READY;
    } else {
      // If not all details for READY are provided, it remains READY_TO_BOOK.
      // The organizer might update some details (e.g., course) without setting time/cost yet.
      updatedGameData.status = GameStatus.READY_TO_BOOK;
    }

    // Update game details and potentially status
    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: updatedGameData,
      include: {
        creator: { include: { profile: true } },
        course: true,
        group: true,
        players: {
          where: { deleted_at: null },
          include: { user: { include: { profile: true } } },
        },
      },
    });

    // NOTIFICATION: If game becomes READY, notify all approved players
    if (updatedGameData.status === GameStatus.READY) {
      try {
        await this.notifyGameConfirmed(updatedGame);
      } catch (error) {
        reportNotificationFailure('game confirmed notifications', error);
      }
    }

    return updatedGame;
  }

  async completeGame(gameId: string, authId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.creator_id !== user.id) {
      throw new ForbiddenException('Only the creator can complete the game');
    }

    // Game must be in READY status to be completed
    if (game.status !== GameStatus.READY) {
      throw new ConflictException(
        `Game must be in READY status to be completed. Current status: ${game.status}`,
      );
    }

    const londonDayFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayLondon = londonDayFormatter.format(new Date());
    const gameDayLondon = londonDayFormatter.format(game.date);
    if (todayLondon < gameDayLondon) {
      throw new ConflictException(
        `Game cannot be completed before the day it is scheduled. Game day: ${gameDayLondon}, today: ${todayLondon}.`,
      );
    }

    // --- Ensure organiser is marked as paid (zero-amount) so that payout logic can succeed ---
    const organiserPlayer = await this.prisma.gamePlayer.findFirst({
      where: {
        game_id: gameId,
        user_id: user.id,
        deleted_at: null,
      },
    });

    if (organiserPlayer && !organiserPlayer.has_paid) {
      await this.prisma.gamePlayer.update({
        where: { id: organiserPlayer.id },
        data: {
          has_paid: true,
          payment_amount: organiserPlayer.payment_amount ?? 0,
        },
      });
    }

    const completedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.COMPLETED },
      include: {
        creator: { include: { profile: true } },
        course: true,
        group: true,
        players: {
          where: { deleted_at: null },
          include: { user: { include: { profile: true } } },
        },
      },
    });

    // NOTIFICATION: Notify non-organiser players that the game is completed
    try {
      await this.notifyGameCompleted(completedGame);
    } catch (error) {
      reportNotificationFailure('game completed notifications', error);
    }

    // NOTIFICATION: Tell the organiser their payout is on the way
    try {
      const paidNonRefundedCount = completedGame.players.filter(
        (p) => p.has_paid && !p.refunded,
      ).length;
      const expectedPayoutPence =
        (completedGame.cost_per_player ?? 0) * paidNonRefundedCount;
      const gameLocation =
        completedGame.course?.name || completedGame.location || 'the game';
      const payoutNotification =
        this.notificationsService.createOrganiserPayoutPendingNotification(
          completedGame.id,
          expectedPayoutPence,
          gameLocation,
        );
      await this.notificationsService.sendNotificationToUser(
        completedGame.creator_id,
        payoutNotification,
      );
    } catch (error) {
      reportNotificationFailure('organiser payout pending notification', error);
    }

    return completedGame;
  }

  async getNearbyUsersForGame(gameId: string, radiusKm: number = 10) {
    const normalizedRadiusKm = Math.max(Number(radiusKm) || 10, 0);

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        course: true,
        players: {
          where: { deleted_at: null },
          select: { user_id: true },
        },
      },
    });

    if (!game || game.deleted_at) {
      throw new NotFoundException('Game not found');
    }

    const gameLat = game.course?.lat ?? game.lat;
    const gameLng = game.course?.lng ?? game.lng;

    if (gameLat == null || gameLng == null) {
      throw new BadRequestException('Game does not have a valid location');
    }

    const existingPlayerIds = game.players.map((player) => player.user_id);

    const users = await this.prisma.user.findMany({
      where: {
        deleted_at: null,
        ...(existingPlayerIds.length > 0
          ? {
              id: {
                notIn: existingPlayerIds,
              },
            }
          : {}),
        latestLocation: {
          deleted_at: null,
        },
      },
      include: {
        profile: true,
        onboarding: true,
        latestLocation: true,
      },
    });

    return users
      .map((user) => {
        if (user.latestLocation?.lat == null || user.latestLocation?.lng == null) {
          return null;
        }

        const distanceKm = this.calculateDistance(
          gameLat,
          gameLng,
          user.latestLocation.lat,
          user.latestLocation.lng,
        );

        return {
          ...user,
          distanceKm,
        };
      })
      .filter(
        (
          user,
        ): user is NonNullable<typeof user> =>
          user !== null && user.distanceKm <= normalizedRadiusKm,
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getNearbyGames(
    latitude: number,
    longitude: number,
    radius: number = 30,
    dateFrom?: Date,
    dateTo?: Date,
    userId?: string,
    userHandicap?: number,
  ) {
    // Build date filter conditions with proper day normalization
    let dateFilter: any;
    if (dateFrom && dateTo) {
      // Both dates provided - normalize to start/end of day
      const normalizedDateFrom = new Date(dateFrom);
      normalizedDateFrom.setHours(0, 0, 0, 0); // Start of the day

      const normalizedDateTo = new Date(dateTo);
      normalizedDateTo.setHours(23, 59, 59, 999); // End of the day

      dateFilter = {
        gte: normalizedDateFrom,
        lte: normalizedDateTo,
      };
    } else if (dateFrom) {
      // Only start date provided - normalize to start of day
      const normalizedDateFrom = new Date(dateFrom);
      normalizedDateFrom.setHours(0, 0, 0, 0); // Start of the day

      dateFilter = {
        gte: normalizedDateFrom,
      };
    } else if (dateTo) {
      // Only end date provided - normalize to end of day
      const normalizedDateTo = new Date(dateTo);
      normalizedDateTo.setHours(23, 59, 59, 999); // End of the day

      dateFilter = {
        lte: normalizedDateTo,
      };
    } else {
      // No dates provided - default to today onwards
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      dateFilter = {
        gte: today,
      };
    }

    const games = await this.prisma.game.findMany({
      where: {
        deleted_at: null,
        status: {
          in: [
            GameStatus.PLAYERS_REQUIRED,
            GameStatus.READY_TO_BOOK,
            GameStatus.READY,
          ],
        },
        date: dateFilter,
      },
      include: {
        creator: { include: { profile: true } },
        course: true,
        group: true,
        players: {
          where: { deleted_at: null },
          include: { user: { include: { profile: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { date: 'asc' },
    });

    return games
      .filter((game) => {
        if (
          userHandicap !== undefined &&
          ((game.handicap_min !== null && userHandicap < game.handicap_min) ||
            (game.handicap_max !== null && userHandicap > game.handicap_max))
        ) {
          return false;
        }

        // Calculate distance using course location or game location
        const gameLat = game.course?.lat ?? game.lat;
        const gameLng = game.course?.lng ?? game.lng;

        if (!gameLat || !gameLng) return false;

        const distance = this.calculateDistance(
          latitude,
          longitude,
          gameLat,
          gameLng,
        );
        return distance <= radius;
      })
      .map((game) => ({
        ...game,
        latest_player_created_at: game.players[0]?.created_at ?? null,
      }));
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async findAllPaginated(paginateGamesDto: PaginateGamesDto) {
    const page = paginateGamesDto.page || 1;
    const limit = paginateGamesDto.limit || 20;
    const skip = (page - 1) * limit;

    const statusFilter = paginateGamesDto.status as AdminGameStatusFilter | undefined;

    const whereClause =
      statusFilter === 'DELETED'
        ? { deleted_at: { not: null } }
        : {
            deleted_at: null,
            ...(statusFilter ? { status: statusFilter } : {}),
          };

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where: whereClause,
        include: {
          creator: { include: { profile: true } },
          course: true,
          group: true,
          players: {
            where: { deleted_at: null },
            include: { user: { include: { profile: true } } },
          },
        },
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.game.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: games,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const game = await this.prisma.game.findUnique({
      where: {
        id,
        deleted_at: null,
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

    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }

    // Check if the user is involved in the game
    // const isInvolved = game.players.some(player => player.user.id === user.id);

    // if (!isInvolved) {
    //   throw new ForbiddenException('User is not authorized to view this game');
    // }

    return game;
  }

  async updateGame(
    gameId: string,
    authId: string,
    updateGameDto: UpdateGameDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          where: { deleted_at: null },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Only the game creator can update the game
    if (game.creator_id !== user.id) {
      throw new ForbiddenException('Only the game creator can update the game');
    }

    // Prevent updates to games that are already completed or cancelled
    if (
      game.status === GameStatus.COMPLETED ||
      game.status === GameStatus.CANCELLED
    ) {
      throw new ConflictException('Cannot update completed or cancelled games');
    }

    // Validate players_needed doesn't go below current approved players
    if (updateGameDto.players_needed !== undefined) {
      const approvedPlayersCount = game.players.filter(
        (p) => p.status === PlayerStatus.APPROVED,
      ).length;

      if (updateGameDto.players_needed < approvedPlayersCount) {
        throw new ConflictException(
          `Cannot reduce players_needed to ${updateGameDto.players_needed}. Game already has ${approvedPlayersCount} approved players.`,
        );
      }
    }

    // Validate handicap range
    if (
      updateGameDto.handicap_min !== undefined &&
      updateGameDto.handicap_max !== undefined
    ) {
      if (updateGameDto.handicap_min > updateGameDto.handicap_max) {
        throw new ConflictException(
          'handicap_min cannot be greater than handicap_max',
        );
      }
    }

    // Calculate cost_per_player if total_cost is provided and players_needed is known
    const finalPlayersNeeded =
      updateGameDto.players_needed ?? game.players_needed;
    let finalCostPerPlayer = updateGameDto.cost_per_player;

    if (updateGameDto.total_cost !== undefined && finalPlayersNeeded > 0) {
      if (updateGameDto.cost_per_player === undefined) {
        // Auto-calculate if not explicitly provided
        finalCostPerPlayer = Math.ceil(
          updateGameDto.total_cost / finalPlayersNeeded,
        );
      }
    }

    // Prepare update data
    const updateData: any = { ...updateGameDto };
    if (finalCostPerPlayer !== undefined) {
      updateData.cost_per_player = finalCostPerPlayer;
    }

    // Update players_current if players_needed changed
    if (updateGameDto.players_needed !== undefined) {
      const approvedPlayers = game.players.filter(
        (p) => p.status === PlayerStatus.APPROVED,
      );
      updateData.players_current = approvedPlayers.length;

      // Update game status based on new player requirements
      if (approvedPlayers.length >= updateGameDto.players_needed) {
        if (game.status === GameStatus.PLAYERS_REQUIRED) {
          updateData.status = GameStatus.READY_TO_BOOK;
        }
      } else {
        if (
          game.status === GameStatus.READY_TO_BOOK ||
          game.status === GameStatus.READY
        ) {
          updateData.status = GameStatus.PLAYERS_REQUIRED;
        }
      }
    }

    return await this.prisma.game.update({
      where: { id: gameId },
      data: updateData,
      include: {
        creator: { include: { profile: true } },
        course: true,
        group: true,
        players: {
          where: { deleted_at: null },
          include: { user: { include: { profile: true } } },
        },
      },
    });
  }

  update(id: number, updateGameDto: UpdateGameDto) {
    return `This action updates a #${id} game`;
  }

  remove(id: number) {
    return `This action removes a #${id} game`;
  }

  // New method to handle player payments
  async processPlayerPayment(
    gameId: string,
    playerId: string,
    paymentIntentId: string,
    amount: number,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          where: {
            deleted_at: null,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const player = game.players.find((p) => p.user_id === playerId);
    if (!player) {
      throw new NotFoundException('Player not found in this game');
    }

    // Update player payment status
    await this.prisma.gamePlayer.update({
      where: { id: player.id },
      data: {
        has_paid: true,
        payment_amount: amount,
        payment_date: new Date(),
        stripe_payment_id: paymentIntentId,
      },
    });

    // Check if all players have paid and update game payment status
    const updatedGame = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          where: {
            deleted_at: null,
          },
        },
      },
    });

    const allPlayersPaid = updatedGame.players.every((p) => p.has_paid);
    const somePlayersPaid = updatedGame.players.some((p) => p.has_paid);

    let paymentStatus: 'PENDING' | 'PARTIALLY_PAID' | 'FULLY_PAID' = 'PENDING';

    if (allPlayersPaid) {
      paymentStatus = 'FULLY_PAID';
    } else if (somePlayersPaid) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        payment_status: paymentStatus,
      },
    });

    // NOTIFICATION: Notify player about successful payment
    try {
      const paymentConfirmationNotification =
        this.notificationsService.createPaymentConfirmationNotification(
          gameId,
          amount,
        );
      await this.notificationsService.sendNotificationToUser(
        playerId,
        paymentConfirmationNotification,
      );

      // NOTIFICATION: If all players have paid, notify creator
      if (paymentStatus === 'FULLY_PAID') {
        const allPaidNotification =
          this.notificationsService.createAllPlayersPaidNotification(gameId);
        await this.notificationsService.sendNotificationToUser(
          updatedGame.creator_id,
          allPaidNotification,
        );
      }
    } catch (error) {
      reportNotificationFailure('payment notifications', error);
    }

    return this.findOne(gameId);
  }

  // New method to handle game completion and organizer payout
  async processGamePayout(gameId: string, adminAuthId: string): Promise<any> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        Complaint: {
          where: {
            status: { in: ['PENDING', 'IN_REVIEW'] },
            deleted_at: null,
          },
        },
        creator: {
          include: {
            stripe_account: true,
          },
        },
        players: {
          where: {
            deleted_at: null,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== 'COMPLETED') {
      throw new ConflictException(
        'Game must be completed before processing payout',
      );
    }

    if (game.payout_completed) {
      throw new ConflictException('Payout has already been processed');
    }

    // Check for unresolved complaints
    if (game.Complaint.length > 0) {
      throw new ConflictException(
        'There are unresolved complaints for this game. Payout is on hold.',
      );
    }

    // Check if creator has Stripe account set up
    if (!game.creator.stripe_account?.stripe_connect_id) {
      throw new ConflictException(
        'Game creator does not have a Stripe account set up for payouts',
      );
    }

    // Get all non-refunded players
    const nonRefundedPlayers = game.players.filter(
      (player) => !player.refunded,
    );

    // Check if all non-refunded players have paid
    const allNonRefundedPaid = nonRefundedPlayers.every(
      (player) => player.has_paid,
    );

    if (!allNonRefundedPaid) {
      throw new ConflictException(
        'All non-refunded players must pay before processing payout',
      );
    }

    // Calculate total payout amount (sum of all non-refunded player payments)
    const totalPayoutAmount = nonRefundedPlayers
      .filter((player) => player.has_paid)
      .reduce(
        (sum, player) =>
          sum + (player.payment_amount ? game.cost_per_player : 0),
        0,
      );

    if (totalPayoutAmount <= 0) {
      const updatedGame = await this.prisma.game.update({
        where: { id: gameId },
        data: { payout_completed: true, payout_date: new Date() },
      });
      // Return a consistent shape so callers can rely on stripe_payout key
      return {
        ...updatedGame,
        stripe_payout: null,
      };
    }

    try {
      // Process payout through Stripe
      const payout = await this.stripeService.createManualPayout(adminAuthId, {
        amount: totalPayoutAmount,
        currency: 'gbp', // Assuming GBP for UK golf courses
        connectedAccountId: game.creator.stripe_account.stripe_connect_id,
        description: `Payout for completed game: ${gameId}`,
        metadata: {
          game_id: gameId,
          creator_user_id: game.creator.id,
          player_count: nonRefundedPlayers
            .filter((player) => player.has_paid)
            .length.toString(),
          total_amount: totalPayoutAmount.toString(),
        },
      });

      // Mark payout as completed in database
      const updatedGame = await this.prisma.game.update({
        where: { id: gameId },
        data: {
          payout_completed: true,
          payout_date: new Date(),
        },
      });

      return {
        ...updatedGame,
        stripe_payout: {
          id: payout.id,
          status: payout.status,
          amount: payout.amount,
        },
      };
    } catch (error) {
      throw new ConflictException(`Failed to process payout: ${error.message}`);
    }
  }

  // Helper method to get user by auth ID
  async getUserByAuthId(authId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getMyGames(authId: string, type: 'pending' | 'upcoming' | 'completed') {
    const user = await this.getUserByAuthId(authId);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today for date comparisons

    const commonInclude = {
      creator: { include: { profile: true } },
      course: true,
      group: true,
      players: {
        where: { deleted_at: null },
        include: { user: { include: { profile: true } } },
      },
      conversation: {
        include: {
          participants: {
            where: { deleted_at: null },
            include: { user: { include: { profile: true } } },
          },
          // Optionally include messages if needed, but can make payload large
          // messages: { where: { deleted_at: null }, orderBy: { created_at: 'asc' }, take: 20 }
        },
      },
    };

    if (type === 'pending') {
      return this.prisma.game.findMany({
        where: {
          deleted_at: null,
          date: { gte: today },
          status: GameStatus.PLAYERS_REQUIRED, // Game needs players
          OR: [
            { creator_id: user.id }, // User is the creator
            {
              players: {
                // User is an APPROVED player in this game
                some: {
                  user_id: user.id,
                  status: PlayerStatus.APPROVED,
                  deleted_at: null,
                },
              },
            },
          ],
        },
        include: commonInclude,
        orderBy: { date: 'asc' },
      });
    } else if (type === 'upcoming') {
      return this.prisma.game.findMany({
        where: {
          deleted_at: null,
          OR: [
            {
              date: { gte: today },
              status: { in: [GameStatus.READY_TO_BOOK, GameStatus.READY] }, // Game is set up or ready
            },
            {
              date: { lt: today },
              status: GameStatus.READY, // Past games that are still in ready status
            },
          ],
          players: {
            // User must be an APPROVED player
            some: {
              user_id: user.id,
              status: PlayerStatus.APPROVED,
              deleted_at: null,
            },
          },
        },
        include: commonInclude,
        orderBy: { date: 'asc' },
      });
    } else if (type === 'completed') {
      return this.prisma.game.findMany({
        where: {
          deleted_at: null,
          players: {
            // User must have been an APPROVED player
            some: {
              user_id: user.id,
              status: PlayerStatus.APPROVED,
              deleted_at: null, // Ensure they weren't removed before completion
            },
          },
          OR: [
            { status: GameStatus.COMPLETED }, // Game is explicitly marked COMPLETED
            {
              // Or, game date is in the past AND it was in a state that implies it was on
              date: { lt: today },
              status: { in: [GameStatus.READY_TO_BOOK] },
            },
          ],
        },
        include: commonInclude,
        orderBy: { date: 'desc' },
      });
    }
  }

  async getUserHistory(authId: string) {
    const user = await this.getUserByAuthId(authId);

    // Check if they've ever joined a game
    const hasJoinedGames =
      (await this.prisma.gamePlayer.count({
        where: {
          user_id: user.id,
          deleted_at: null,
        },
      })) > 0;

    // Check if they've ever created a game
    const hasCreatedGames =
      (await this.prisma.game.count({
        where: {
          creator_id: user.id,
          deleted_at: null,
        },
      })) > 0;

    return {
      hasJoinedGames,
      hasCreatedGames,
    };
  }

  async getGamePaymentDetails(payerAuthId: string, gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found.`);
    }

    // --- Perform all the same business logic checks ---
    if (game.status !== GameStatus.READY) {
      throw new BadRequestException('This game is not ready for payment.');
    }

    const payer = await this.getUserByAuthId(payerAuthId);
    const payerGamePlayer = game.players.find((p) => p.user_id === payer.id);

    if (!payerGamePlayer) {
      throw new ForbiddenException('You are not a player in this game.');
    }

    if (payerGamePlayer.status !== PlayerStatus.APPROVED) {
      throw new ForbiddenException(
        'Your spot in this game must be approved to make a payment.',
      );
    }

    if (payerGamePlayer.has_paid) {
      throw new BadRequestException('You have already paid for this game.');
    }

    if (!game.cost_per_player || game.cost_per_player <= 0) {
      throw new BadRequestException(
        'The cost for this game has not been set by the organizer.',
      );
    }

    // --- Calculate and return the cost breakdown ---
    const playerShare = game.cost_per_player; // This is in cents
    const applicationFee = Math.round(playerShare * 0.1); // 10% fee
    const totalAmount = playerShare + applicationFee;

    return {
      playerShare,
      applicationFee,
      totalAmount,
      currency: 'gbp', // Or from config/game
    };
  }

  async createGamePaymentIntent(
    payerAuthId: string,
    gameId: string,
  ): Promise<any> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
        creator: true,
      },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found.`);
    }

    // 1. --- Re-run Business Logic Validations (important for security) ---
    if (game.status !== GameStatus.READY) {
      throw new BadRequestException('This game is not ready for payment.');
    }

    const payer = await this.getUserByAuthId(payerAuthId);
    const payerGamePlayer = game.players.find((p) => p.user_id === payer.id);

    if (!payerGamePlayer) {
      throw new ForbiddenException('You are not a player in this game.');
    }

    if (payerGamePlayer.status !== PlayerStatus.APPROVED) {
      throw new ForbiddenException(
        'Your spot in this game must be approved to make a payment.',
      );
    }

    if (payerGamePlayer.has_paid) {
      throw new BadRequestException('You have already paid for this game.');
    }

    if (!game.cost_per_player || game.cost_per_player <= 0) {
      throw new BadRequestException(
        'The cost for this game has not been set by the organizer.',
      );
    }

    if (!game.creator.auth_id) {
      throw new NotFoundException(
        "Could not find the game creator's details to process payment.",
      );
    }

    // 2. --- Calculate fees again (server is the source of truth) ---
    const playerShare = game.cost_per_player;
    const applicationFee = Math.round(playerShare * 0.1);
    const totalAmount = playerShare + applicationFee;

    const paymentIntentDto = {
      amount: totalAmount,
      currency: 'gbp',
      recipientAuthId: game.creator.auth_id,
      applicationFeeAmount: applicationFee,
      metadata: {
        game_id: game.id,
        game_player_id: payerGamePlayer.id,
        payer_user_id: payer.id,
        playerShare: playerShare.toString(),
        applicationFee: applicationFee.toString(),
      },
    };

    // 3. --- Call Stripe Service ---
    return this.stripeService.createPaymentIntent(
      payerAuthId,
      paymentIntentDto,
    );
  }

  // ===================== personalised suggestions =====================
  async getSuggestedGames(
    authId: string,
    opts: {
      radiusKm?: number;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      lat?: number;
      lng?: number;
      q?: string;
    } = {},
  ) {
    const radiusKm = opts.radiusKm ?? 30;
    const searchTerm = opts.q?.trim();

    // Normalize dates to start/end of day for proper date-based filtering
    let dateFrom: Date;
    let dateTo: Date;

    if (opts.dateFrom) {
      dateFrom = new Date(opts.dateFrom);
      dateFrom.setHours(0, 0, 0, 0); // Start of the day
    } else {
      dateFrom = new Date();
      dateFrom.setHours(0, 0, 0, 0); // Start of today
    }

    if (opts.dateTo) {
      dateTo = new Date(opts.dateTo);
      dateTo.setHours(23, 59, 59, 999); // End of the day
    } else {
      dateTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      dateTo.setHours(23, 59, 59, 999); // End of the day
    }

    // ---- base user context ----
    const user = await this.getUserByAuthId(authId);
    const profile = await this.prisma.profile.findUnique({
      where: { user_id: user.id },
    });
    const onboarding = await this.prisma.userOnboarding.findUnique({
      where: { user_id: user.id },
      include: { availability: { include: { time_slots: true } } },
    });

    // Use provided coordinates or fall back to stored user location
    let userLat: number | undefined;
    let userLng: number | undefined;

    if (opts.lat !== undefined && opts.lng !== undefined) {
      userLat = opts.lat;
      userLng = opts.lng;
      console.log('Using provided coordinates:', { userLat, userLng });
    } else {
      const loc = await this.prisma.userLocation.findUnique({
        where: { user_id: user.id },
      });
      if (loc) {
        userLat = loc.lat;
        userLng = loc.lng;
        console.log('Using stored user location:', { userLat, userLng });
      } else {
        console.log('No stored user location found');
      }
    }

    // ---- availability filter helper ----
    const allowedSlots = new Set<string>();
    if (onboarding?.availability?.time_slots?.length) {
      onboarding.availability.time_slots.forEach((ts) =>
        allowedSlots.add(`${ts.day_type}-${ts.time_slot}`),
      );
    }

    // ---- bounding box for location ----
    let locationFilter: any = {};
    if (userLat !== undefined && userLng !== undefined) {
      const deg = radiusKm / 111; // ~1 degree = 111 km
      locationFilter = {
        course: {
          lat: { gte: userLat - deg, lte: userLat + deg },
          lng: { gte: userLng - deg, lte: userLng + deg },
        },
      };
    }
    // ---- fetch candidate games ----
    const candidateGamesRaw = await this.prisma.game.findMany({
      where: {
        deleted_at: null,
        status: {
          in: [
            GameStatus.PLAYERS_REQUIRED,
            GameStatus.READY_TO_BOOK,
            GameStatus.READY,
          ],
        },
        date: { gte: dateFrom, lte: dateTo },
        ...(userLat !== undefined && userLng !== undefined
          ? locationFilter
          : {}),
        ...(searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' as const } },
                {
                  course: {
                    name: { contains: searchTerm, mode: 'insensitive' as const },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        course: { select: { id: true, name: true, lat: true, lng: true } },
        players: {
          where: { deleted_at: null },
          include: { user: { include: { profile: true } } },
        },
      },
    });

    // availability post-filter
    const candidateGames = allowedSlots.size
      ? candidateGamesRaw.filter((g) => {
          const dayType: any = [0, 6].includes(g.date.getDay())
            ? 'WEEKEND'
            : 'WEEKDAY';
          return allowedSlots.has(`${dayType}-${g.time_slot}`);
        })
      : candidateGamesRaw;

    // ---- social graph sets ----
    // follows
    const outgoingFollows = await this.prisma.follow.findMany({
      where: { follower_id: user.id, deleted_at: null },
      select: { following_id: true },
    });
    const incomingFollows = await this.prisma.follow.findMany({
      where: { following_id: user.id, deleted_at: null },
      select: { follower_id: true },
    });
    const followingSet = new Set(outgoingFollows.map((f) => f.following_id));
    const followerSet = new Set(incomingFollows.map((f) => f.follower_id));
    const strongTies = new Set(
      [...followingSet].filter((id) => followerSet.has(id)),
    );

    // group mates
    const userGroups = await this.prisma.groupMember.findMany({
      where: { user_id: user.id, deleted_at: null },
      select: { group_id: true },
    });
    let groupMateSet: Set<string> = new Set();
    if (userGroups.length) {
      const groupMates = await this.prisma.groupMember.findMany({
        where: {
          group_id: { in: userGroups.map((g) => g.group_id) },
          user_id: { not: user.id },
          deleted_at: null,
        },
        select: { user_id: true },
      });
      groupMateSet = new Set(groupMates.map((m) => m.user_id));
    }

    // past game mates
    const pastGames = await this.prisma.gamePlayer.findMany({
      where: { user_id: user.id, status: 'APPROVED', deleted_at: null },
      select: { game_id: true },
    });
    let pastMateSet: Set<string> = new Set();
    if (pastGames.length) {
      const mates = await this.prisma.gamePlayer.findMany({
        where: {
          game_id: { in: pastGames.map((g) => g.game_id) },
          user_id: { not: user.id },
          status: 'APPROVED',
          deleted_at: null,
        },
        distinct: ['user_id'],
        select: { user_id: true },
      });
      pastMateSet = new Set(mates.map((m) => m.user_id));
    }

    // medium ties = union of following, group mates, past mates minus strong
    const mediumTies = new Set<string>([
      ...followingSet,
      ...groupMateSet,
      ...pastMateSet,
    ]);
    strongTies.forEach((id) => mediumTies.delete(id));

    // ---- score and sort ----
    const strategy = new SuggestionStrategy(radiusKm);

    // Create a location object for the scoring strategy or use null
    const loc =
      userLat !== undefined && userLng !== undefined
        ? ({ lat: userLat, lng: userLng } as any) // Type assertion to match UserLocation interface
        : null;

    const scored = candidateGames.map((g) => ({
      game: g,
      score: strategy.computeScore(g as any, {
        user,
        profile,
        onboarding,
        loc,
        strongTies,
        mediumTies,
      }),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, opts.limit ?? 1000).map((s) => s.game);
  }

  /**
   * Returns games that are completed, older than `cutoffDays`,
   * not yet paid out and enriched with counts helpful for the
   * admin payout-review dashboard.
   */
  async getGamesForPayoutReview(cutoffDays = 2) {
    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - cutoffDays);

    /* 1️⃣  Fetch candidate games (unchanged) */
    const games = await this.prisma.game.findMany({
      where: {
        deleted_at: null,
        payout_completed: false,
        status: GameStatus.COMPLETED,
        date: { lt: cutOffDate },
      },
      include: {
        creator: { include: { profile: true } },
        course: true,
        players: {
          where: { deleted_at: null },
          include: { user: { include: { profile: true } } },
        },
        Complaint: { where: { deleted_at: null } },
      },
      orderBy: { date: 'asc' },
    });

    /* 2️⃣  Pre-compute first ever payment date for each organiser */
    const creatorIds = [...new Set(games.map((g) => g.creator_id))];

    const firstPaymentMap: Record<string, Date | null> = {};
    for (const creatorId of creatorIds) {
      const firstPayment = await this.prisma.gamePlayer.findFirst({
        where: {
          game: { creator_id: creatorId },
          has_paid: true,
          payment_date: { not: null },
        },
        orderBy: { payment_date: 'asc' }, // earliest payment
        select: { payment_date: true },
      });
      firstPaymentMap[creatorId] = firstPayment?.payment_date ?? null;
    }

    /* 3️⃣  Decorate each game with the extra flag */
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    return games.map((g) => {
      /* existing derived fields */
      const pendingComplaintCount = g.Complaint.filter(
        (c) =>
          c.status === ComplaintStatus.PENDING ||
          c.status === ComplaintStatus.IN_REVIEW,
      ).length;
      const unpaidPlayerCount = g.players.filter(
        (p) => !p.has_paid && !p.refunded,
      ).length;

      /* seven-day logic only for the organiser’s FIRST payout */
      const organiserHasPreviousPayout = games.some(
        (other) =>
          other.creator_id === g.creator_id &&
          other.id !== g.id &&
          other.payout_completed,
      );

      const firstPaymentDate = firstPaymentMap[g.creator_id];
      const sevenDaysSinceFirstPayment =
        firstPaymentDate &&
        Date.now() - firstPaymentDate.getTime() >= SEVEN_DAYS_MS;

      const requiresSevenDayHold = !organiserHasPreviousPayout;
      const sevenDayRuleSatisfied = requiresSevenDayHold
        ? sevenDaysSinceFirstPayment
        : true;

      const readyForPayout =
        !g.payout_completed &&
        unpaidPlayerCount === 0 &&
        pendingComplaintCount === 0 &&
        sevenDayRuleSatisfied;

      return {
        ...g,
        pendingComplaintCount,
        unpaidPlayerCount,
        readyForPayout,
      };
    });
  }

  // Helper methods for notifications
  private async notifyGameReadyToBook(game: any) {
    const approvedPlayers = game.players.filter(
      (p) => p.status === PlayerStatus.APPROVED,
    );
    const gameLocation = game.course?.name || game.location || 'the game';
    const readyNotification =
      this.notificationsService.createGameReadyToBookNotification(
        game.id,
        gameLocation,
      );

    for (const player of approvedPlayers) {
      try {
        await this.notificationsService.sendNotificationToUser(
          player.user_id,
          readyNotification,
        );
      } catch (error) {
        console.error(
          `Failed to send ready notification to player ${player.user_id}:`,
          error,
        );
      }
    }
  }

  private async notifyGameConfirmed(game: any) {
    const approvedPlayers = game.players.filter(
      (p) => p.status === PlayerStatus.APPROVED,
    );
    const gameLocation = game.course?.name || game.location || 'the game';
    const confirmedNotification =
      this.notificationsService.createGameConfirmedNotification(
        game.id,
        gameLocation,
        game.exact_time,
        game.date,
      );

    for (const player of approvedPlayers) {
      try {
        await this.notificationsService.sendNotificationToUser(
          player.user_id,
          confirmedNotification,
        );
      } catch (error) {
        console.error(
          `Failed to send confirmed notification to player ${player.user_id}:`,
          error,
        );
      }
    }
  }

  private async notifyGameCompleted(game: any) {
    const approvedPlayers = game.players.filter(
      (p) =>
        p.status === PlayerStatus.APPROVED && p.user_id !== game.creator_id,
    );
    const gameLocation = game.course?.name || game.location || 'the game';
    const completedNotification =
      this.notificationsService.createGameCompletedNotification(
        game.id,
        gameLocation,
      );

    for (const player of approvedPlayers) {
      try {
        await this.notificationsService.sendNotificationToUser(
          player.user_id,
          completedNotification,
        );
      } catch (error) {
        console.error(
          `Failed to send completed notification to player ${player.user_id}:`,
          error,
        );
      }
    }
  }
}
