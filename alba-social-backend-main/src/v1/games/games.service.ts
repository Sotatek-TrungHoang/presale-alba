import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameStatus, InviteStatus, PlayerStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';
import { CreateGameDto } from './create-game.dto';
import { ConfirmGameDto } from './confirm-game.dto';
import { UpdateGameDto } from './update-game.dto';

@Injectable()
export class V1GamesService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  async getAllGamesForUser(authId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.game.findMany({
      where: {
        deleted_at: null,
        players: {
          some: {
            user_id: user.id,
            deleted_at: null,
          },
        },
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
      orderBy: { date: 'desc' },
    });
  }

  async createGame(authId: string, createGameDto: CreateGameDto) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (createGameDto.players_needed < 2) {
      throw new BadRequestException('players_needed must be greater than 1');
    }

    const game = await this.prisma.game.create({
      data: {
        creator: { connect: { id: user.id } },
        course: { connect: { id: createGameDto.course_id } },
        date: createGameDto.date,
        time_slot: createGameDto.time_slot,
        players_current: 1,
        players_needed: createGameDto.players_needed,
        initial_players_needed: createGameDto.players_needed,
        game_type: createGameDto.game_type,
        game_format: createGameDto.game_format,
        organiser_handicap: createGameDto.organiser_handicap,
        cost_per_player: createGameDto.cost_per_player,
        status: GameStatus.PLAYERS_REQUIRED,
        players: {
          create: {
            user: { connect: { id: user.id } },
            status: PlayerStatus.APPROVED,
            has_approved: true,
            invite_status: InviteStatus.NOT_INVITED,
          },
        },
      },
      include: {
        course: true,
        players: true,
      },
    });

    return game;
  }

  async confirmGame(authId: string, gameId: string, dto: ConfirmGameDto) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: { where: { deleted_at: null } },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.creator_id !== user.id) {
      throw new ForbiddenException('Only the creator can confirm game details');
    }

    if (game.status !== GameStatus.READY_TO_BOOK) {
      throw new ConflictException(
        `Game must be in READY_TO_BOOK status to confirm details. Current status: ${game.status}`,
      );
    }

    const creatorPlayer = game.players.find((p) => p.user_id === game.creator_id);
    if (!creatorPlayer) {
      throw new ConflictException('Creator player record not found. Cannot confirm game.');
    }

    if (creatorPlayer.status !== PlayerStatus.APPROVED) {
      await this.prisma.gamePlayer.update({
        where: { id: creatorPlayer.id },
        data: { status: PlayerStatus.APPROVED, has_approved: true },
      });
    }

    if (!creatorPlayer.has_paid) {
      await this.prisma.gamePlayer.update({
        where: { id: creatorPlayer.id },
        data: { has_paid: true, payment_amount: 0, payment_date: new Date() },
      });
    }

    const exactTime = dto.exact_time ?? game.exact_time;
    const newStatus = exactTime ? GameStatus.READY : GameStatus.READY_TO_BOOK;

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        course_id: dto.course_id ?? game.course_id,
        date: dto.date ?? game.date,
        time_slot: dto.time_slot ?? game.time_slot,
        exact_time: exactTime,
        status: newStatus,
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
  }

  async updateGame(authId: string, gameId: string, dto: UpdateGameDto) {
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
      throw new ForbiddenException('Only the game creator can update the game');
    }

    if (
      game.status === GameStatus.COMPLETED ||
      game.status === GameStatus.CANCELLED
    ) {
      throw new ConflictException('Cannot update completed or cancelled games');
    }

    const approvedPlayersCount = game.players.filter(
      (player) => player.status === PlayerStatus.APPROVED,
    ).length;

    if (
      dto.players_needed !== undefined &&
      dto.players_needed < approvedPlayersCount
    ) {
      throw new ConflictException(
        `Cannot reduce players_needed to ${dto.players_needed}. Game already has ${approvedPlayersCount} approved players.`,
      );
    }

    if (
      dto.cost_per_player !== undefined &&
      game.status !== GameStatus.PLAYERS_REQUIRED
    ) {
      throw new ConflictException(
        'cost_per_player can only be updated while the game is in PLAYERS_REQUIRED status',
      );
    }

    const finalPlayersNeeded = dto.players_needed ?? game.players_needed;
    const updateData: any = {
      ...dto,
      players_current: approvedPlayersCount,
    };

    if (approvedPlayersCount >= finalPlayersNeeded) {
      if (game.status === GameStatus.PLAYERS_REQUIRED) {
        updateData.status = GameStatus.READY_TO_BOOK;
      }
    } else if (
      game.status === GameStatus.READY_TO_BOOK ||
      game.status === GameStatus.READY
    ) {
      updateData.status = GameStatus.PLAYERS_REQUIRED;
    }

    return this.prisma.game.update({
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

  async createVirtualCardForGame(authId: string, gameId: string) {
    return this.stripeService.createVirtualCardForGame(authId, gameId);
  }

  async createPaymentIntentForGame(authId: string, gameId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId, deleted_at: null },
      include: {
        players: {
          where: { user_id: user.id, deleted_at: null },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (!game.cost_per_player) {
      throw new BadRequestException('This game has no cost set');
    }

    const gamePlayer = game.players[0];
    if (!gamePlayer) {
      throw new ForbiddenException('You are not a player in this game');
    }

    if (gamePlayer.status !== PlayerStatus.APPROVED) {
      throw new ForbiddenException('Only confirmed players can pay');
    }

    if (gamePlayer.has_paid) {
      throw new BadRequestException('You have already paid for this game');
    }

    const playerShare = game.cost_per_player;
    const applicationFee = Math.round(playerShare * 0.1);
    const totalAmount = playerShare + applicationFee;

    const paymentIntent = await this.stripeService.createPlatformPaymentIntent(
      authId,
      gamePlayer.id,
      {
        amount: totalAmount,
        currency: 'gbp',
        metadata: { game_id: game.id },
      },
    );

    return {
      ...paymentIntent,
      playerShare,
      applicationFee,
      totalAmount,
    };
  }
}
