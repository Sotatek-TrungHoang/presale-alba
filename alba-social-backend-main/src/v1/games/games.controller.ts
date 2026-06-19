import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { V1GamesService } from './games.service';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';

import { CreateGameDto } from './create-game.dto';
import { ConfirmGameDto } from './confirm-game.dto';
import { UpdateGameDto } from './update-game.dto';

@ApiTags('v1/games')
@Controller('v1/games')
export class V1GamesController {
  constructor(private readonly gamesService: V1GamesService) {}

  @ApiOperation({ summary: 'Get all games for the authenticated user' })
  @UseGuards(FirebaseAuthGuard)
  @Get()
  async getGames(@Request() req) {
    return this.gamesService.getAllGamesForUser(req.user.uid);
  }

  @ApiOperation({ summary: 'Create a game' })
  @UseGuards(FirebaseAuthGuard)
  @Post()
  async createGame(@Request() req, @Body() createGameDto: CreateGameDto) {
    return this.gamesService.createGame(req.user.uid, createGameDto);
  }

  @ApiOperation({ summary: 'Create a payment intent for a game' })
  @UseGuards(FirebaseAuthGuard)
  @Post(':id/pay')
  async payForGame(@Request() req, @Param('id') id: string) {
    return this.gamesService.createPaymentIntentForGame(req.user.uid, id);
  }

  @ApiOperation({ summary: 'Update a game' })
  @UseGuards(FirebaseAuthGuard)
  @Patch(':id')
  async updateGame(
    @Request() req,
    @Param('id') id: string,
    @Body() updateGameDto: UpdateGameDto,
  ) {
    return this.gamesService.updateGame(req.user.uid, id, updateGameDto);
  }

  @ApiOperation({ summary: 'Confirm game details' })
  @UseGuards(FirebaseAuthGuard)
  @Patch(':id/confirm')
  async confirmGame(
    @Request() req,
    @Param('id') id: string,
    @Body() confirmGameDto: ConfirmGameDto,
  ) {
    return this.gamesService.confirmGame(req.user.uid, id, confirmGameDto);
  }

  @ApiOperation({ summary: 'Issue a virtual card for a game' })
  @UseGuards(FirebaseAuthGuard)
  @Post(':id/virtual-card')
  async createVirtualCardForGame(@Request() req, @Param('id') id: string) {
    console.log(`Issuing virtual card for game ${id} by user ${req.user.uid}`);
    return this.gamesService.createVirtualCardForGame(req.user.uid, id);
  }
}
