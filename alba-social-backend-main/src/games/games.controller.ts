import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
  ConflictException,
  Delete,
  ValidationPipe,
  HttpException,
  HttpStatus,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { JoinGameDto } from './dto/join-game.dto';
import { UpdateGameStatusDto } from './dto/update-game-status.dto';
import { UpdatePlayerStatusDto } from './dto/update-player-status.dto';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { GetMyGamesQueryDto } from './dto/get-my-games-query.dto';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  async createGame(@Request() req, @Body() createGameDto: CreateGameDto) {
    return this.gamesService.createGame(req.user.uid, createGameDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('join')
  async joinGame(@Request() req, @Body() joinGameDto: JoinGameDto) {
    return this.gamesService.joinGame(req.user.uid, joinGameDto);
  }

  @Get('nearby')
  async getNearbyGames(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('userId') userId?: string,
  ) {
    const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
    const parsedDateTo = dateTo ? new Date(dateTo) : undefined;

    return this.gamesService.getNearbyGames(
      parseFloat(latitude.toString()),
      parseFloat(longitude.toString()),
      parseFloat(radius.toString()),
      parsedDateFrom,
      parsedDateTo,
      userId,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('suggested')
  async getSuggestedGames(
    @Request() req,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('q') q?: string,
  ) {
    return this.gamesService.getSuggestedGames(req.user.uid, {
      radiusKm: radius ? Number(radius) : undefined,
      limit: limit ? Number(limit) : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      q,
    });
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('my-games')
  async getMyGames(
    @Request() req,
    @Query(new ValidationPipe({ transform: true })) query: GetMyGamesQueryDto,
  ) {
    return this.gamesService.getMyGames(req.user.uid, query.type);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('user-history')
  async getUserHistory(@Request() req) {
    return this.gamesService.getUserHistory(req.user.uid);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('admin/payout-review')
  async getGamesNeedingPayoutReview(
    @Request() req,
    @Query('cutoff', ParseIntPipe) cutoff?: number,
  ) {
    const user = await this.gamesService.getUserByAuthId(req.user.uid);
    if (!user.admin_status) {
      throw new ForbiddenException('Only admins can access this resource');
    }

    const days = cutoff ?? 2; // default to 2 days if query param is absent
    return this.gamesService.getGamesForPayoutReview(days);
  }

  @Get(':id')
  async getGame(@Request() req, @Param('id') id: string) {
    return this.gamesService.findOne(id);
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch(':id')
  async updateGame(
    @Request() req,
    @Param('id') id: string,
    @Body() updateGameDto: UpdateGameDto,
  ) {
    return this.gamesService.updateGame(id, req.user.uid, updateGameDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch(':id/players/:playerId')
  async updatePlayerStatus(
    @Request() req,
    @Param('id') id: string,
    @Param('playerId') playerId: string,
    @Body() updatePlayerStatusDto: UpdatePlayerStatusDto,
  ) {
    return this.gamesService.updatePlayerStatus(
      id,
      playerId,
      req.user.uid,
      updatePlayerStatusDto,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch(':id/invitations/:userId')
  async respondToInvitation(
    @Request() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() response: { action: 'ACCEPT' | 'DECLINE' },
  ) {
    return this.gamesService.respondToInvitation(
      req.user.uid,
      id,
      userId,
      response.action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED',
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch(':id/confirm')
  async confirmGameDetails(
    @Request() req,
    @Param('id') id: string,
    @Body() updateGameStatusDto: UpdateGameStatusDto,
  ) {
    const authId = req.user.uid;
    return this.gamesService.confirmGameDetails(
      id,
      authId,
      updateGameStatusDto,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch(':id/complete')
  async completeGame(@Request() req, @Param('id') id: string) {
    return this.gamesService.completeGame(id, req.user.uid);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post(':id/players/:playerId/payment')
  async processPayment(
    @Request() req,
    @Param('id') gameId: string,
    @Param('playerId') playerId: string,
    @Body() paymentData: { payment_intent_id: string; amount: number },
  ) {
    const user = await this.gamesService.getUserByAuthId(req.user.uid);
    if (user.id !== playerId) {
      throw new ConflictException('You can only process payments for yourself');
    }

    return this.gamesService.processPlayerPayment(
      gameId,
      playerId,
      paymentData.payment_intent_id,
      paymentData.amount,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Post(':id/payout')
  async processPayout(@Request() req, @Param('id') gameId: string) {
    const user = await this.gamesService.getUserByAuthId(req.user.uid);

    // Check if user is an admin
    if (!user.admin_status) {
      throw new ForbiddenException('Only admins can process payouts');
    }

    return this.gamesService.processGamePayout(gameId, req.user.uid);
  }

  @Get(':id/payment-details')
  @UseGuards(FirebaseAuthGuard)
  async getGamePaymentDetails(@Request() req, @Param('id') gameId: string) {
    const authId = req.user.uid;
    try {
      const paymentDetails = await this.gamesService.getGamePaymentDetails(
        authId,
        gameId,
      );
      return paymentDetails;
    } catch (error) {
      console.error(
        `Error getting payment details for game ${gameId} by user ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get payment details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/payment')
  @UseGuards(FirebaseAuthGuard)
  async createGamePaymentIntent(@Request() req, @Param('id') gameId: string) {
    const authId = req.user.uid;
    try {
      const paymentInfo = await this.gamesService.createGamePaymentIntent(
        authId,
        gameId,
      );
      return paymentInfo;
    } catch (error) {
      console.error(
        `Error creating game payment intent for game ${gameId} by user ${authId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create payment intent for game',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
