import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { GamesService } from '../../games/games.service';
import {
  ADMIN_GAME_STATUS_FILTERS,
  PaginateGamesDto,
} from '../../games/dto/pagination-games.dto';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { AdminGamesService } from './games.service';
import { UpdateAdminGameDto } from './dto/update-admin-game.dto';
import { AddAdminGamePlayerDto } from './dto/add-admin-game-player.dto';
import { CreateAdminGameDto } from './dto/create-admin-game.dto';
import { UpdateAdminGamePlayerStatusDto } from './dto/update-admin-game-player-status.dto';
import { NotifyNearbyUsersDto } from './dto/notify-nearby-users.dto';

@ApiTags('admin')
@Controller('admin/games')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminGamesController {
  constructor(
    private readonly gamesService: GamesService,
    private readonly adminGamesService: AdminGamesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a game (Admin only)',
    description:
      'Creates a game in PLAYERS_REQUIRED status. players_needed must be greater than 2. Requires Firebase authentication and admin privileges.',
  })
  createGame(@Request() req, @Body() createAdminGameDto: CreateAdminGameDto) {
    return this.adminGamesService.createGame(req.user.uid, createAdminGameDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get paginated list of games (Admin only)',
    description:
      'Retrieve a paginated list of games including creator, course, group, and player details. Requires Firebase authentication and admin privileges.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (starting from 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page (max 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ADMIN_GAME_STATUS_FILTERS,
    description:
      'Optional game status filter. Use DELETED to return soft-deleted games.',
    example: 'DELETED',
  })
  findAllPaginated(@Query() paginateGamesDto: PaginateGamesDto) {
    return this.gamesService.findAllPaginated(paginateGamesDto);
  }

  @Get(':id/nearby-users')
  @ApiOperation({
    summary: 'Get users near a game (Admin only)',
    description:
      'Returns non-deleted users with a saved location who are within the requested radius of the game or its course location, excluding users already in the game. Defaults to 10km and supports up to 100km.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the game',
    example: 'clh1234567890',
  })
  @ApiQuery({
    name: 'radius',
    required: false,
    type: Number,
    description: 'Optional search radius in kilometers. Defaults to 10 and is capped at 100.',
    example: 25,
  })
  getNearbyUsersForGame(
    @Param('id') id: string,
    @Query('radius') radius?: string,
  ) {
    const parsedRadius = Number(radius);
    const normalizedRadius =
      radius === undefined || Number.isNaN(parsedRadius)
        ? 10
        : Math.min(Math.max(parsedRadius, 0), 100);

    return this.gamesService.getNearbyUsersForGame(id, normalizedRadius);
  }

  @Post(':id/nearby-users/notify')
  @ApiOperation({
    summary: 'Notify selected users about a game (Admin only)',
    description:
      'Accepts a list of user IDs and sends a Game Nearby notification as long as they are not already part of the game.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the game',
    example: 'clh1234567890',
  })
  notifyNearbyUsers(
    @Param('id') id: string,
    @Body() notifyNearbyUsersDto: NotifyNearbyUsersDto,
  ) {
    return this.adminGamesService.notifyNearbyUsers(
      id,
      notifyNearbyUsersDto.user_ids,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific game by ID (Admin only)',
    description:
      'Retrieve detailed information about a specific game including players, conversation, and course details. Requires Firebase authentication and admin privileges.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the game',
    example: 'clh1234567890',
  })
  findOne(@Param('id') id: string) {
    return this.gamesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a game (Admin only)',
    description:
      'Update any mutable game field including ownership, scheduling, relations, payment fields, and soft-delete state. Requires Firebase authentication and admin privileges.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the game',
    example: 'clh1234567890',
  })
  updateGame(
    @Param('id') id: string,
    @Body() updateAdminGameDto: UpdateAdminGameDto,
  ) {
    return this.adminGamesService.updateGame(id, updateAdminGameDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a game (Admin only)',
    description:
      'Soft deletes a game by setting deleted_at. Use status=DELETED on the index route to retrieve soft-deleted games.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the game',
    example: 'clh1234567890',
  })
  deleteGame(@Param('id') id: string) {
    return this.adminGamesService.deleteGame(id);
  }

  @Post(':id/players')
  @ApiOperation({
    summary: 'Add a player to a game (Admin only)',
    description:
      'Adds a user to a game as a player with PENDING status. Requires Firebase authentication and admin privileges.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the game',
    example: 'clh1234567890',
  })
  addPlayerToGame(
    @Param('id') id: string,
    @Body() addAdminGamePlayerDto: AddAdminGamePlayerDto,
  ) {
    return this.adminGamesService.addPlayerToGame(id, addAdminGamePlayerDto.user_id);
  }

  @Patch(':id/players/:userId/status')
  @ApiOperation({
    summary: 'Update a game player status (Admin only)',
    description:
      'Updates the status of a game player and recalculates players_current and game status. Requires Firebase authentication and admin privileges.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the game',
    example: 'clh1234567890',
  })
  @ApiParam({
    name: 'userId',
    type: String,
    description: 'The unique identifier of the user in the game',
    example: 'clh0987654321',
  })
  updateGamePlayerStatus(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() updateAdminGamePlayerStatusDto: UpdateAdminGamePlayerStatusDto,
  ) {
    return this.adminGamesService.updateGamePlayerStatus(
      id,
      userId,
      updateAdminGamePlayerStatusDto.status,
    );
  }

  @Delete(':id/players/:userId')
  @ApiOperation({
    summary: 'Remove a player from a game (Admin only)',
    description:
      'Removes a player from a game only if they have not paid. Recalculates players_current and game status using admin player-count status logic.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the game',
    example: 'clh1234567890',
  })
  @ApiParam({
    name: 'userId',
    type: String,
    description: 'The unique identifier of the user to remove',
    example: 'clh0987654321',
  })
  removePlayerFromGame(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.adminGamesService.removePlayerFromGame(id, userId);
  }
}
