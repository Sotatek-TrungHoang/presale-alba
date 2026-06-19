import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { UserOnboardingDto } from './dto/user-onboarding.dto';
import { CreateUserWithOnboardingDto } from './dto/create-user-with-onboarding.dto';
import { UpdateUserLocationDto } from './dto/update-user-location.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  /**
   * Create a new user with onboarding data in a single operation
   */
  @Post('signup-with-onboarding')
  async createWithOnboarding(@Body() dto: CreateUserWithOnboardingDto) {
    const result = await this.usersService.createWithOnboarding(dto);
    return result;
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('me')
  async findMe(@Req() req) {
    return this.usersService.findOneByAuthId(req.user.uid);
  }

  // NEW: Delete currently authenticated user account
  @UseGuards(FirebaseAuthGuard)
  @Delete('me')
  async deleteMe(@Req() req) {
    return this.usersService.deleteAccount(req.user.uid);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('search')
  searchUsers(@Query() searchUsersDto: SearchUsersDto, @Req() req) {
    return this.usersService.searchUsers(searchUsersDto, req.user.uid);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('home-feed')
  async getHomeFeed(
    @Req() req,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.usersService.getHomeFeed(req.user.uid, cursor, parsedLimit);
  }

  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  findOne(@Req() req, @Param('id') id: string) {
    return this.usersService.findOne(id, req.user.uid);
  }

  @Get(':id/groups')
  findUserGroups(@Param('id') id: string) {
    return this.usersService.findUserGroups(id);
  }

  @Get(':id/leagues')
  findUserLeagues(@Param('id') id: string) {
    return this.usersService.findUserLeagues(id);
  }

  @Get(':id/favourite-courses')
  findFavouriteCourses(@Param('id') id: string) {
    return this.usersService.findFavouriteCourses(id);
  }

  @Get(':id/favourite-courses-details')
  async findUserFavouriteCoursesDetails(@Param('id') id: string) {
    return this.usersService.findUserFavouriteCoursesDetails(id);
  }

  @Get(':id/followers')
  findFollowers(@Param('id') id: string) {
    return this.usersService.findFollowers(id);
  }

  @Get(':id/following')
  findFollowing(@Param('id') id: string) {
    return this.usersService.findFollowing(id);
  }

  @Get(':id/games')
  findGames(@Param('id') id: string) {
    return this.usersService.findGames(id);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get(':id/open-games')
  findUpcomingGames(@Req() req, @Param('id') id: string) {
    return this.usersService.findOpenGames(req.user.uid, id);
  }

  @Get(':id/feed')
  async getUserFeed(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.usersService.getUserFeed(id, cursor, parsedLimit);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('onboarding')
  async saveOnboarding(@Req() req, @Body() onboardingData: UserOnboardingDto) {
    return this.usersService.saveOnboardingData(req.user.uid, onboardingData);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('onboarding')
  async getOnboarding(@Req() req) {
    try {
      const result = await this.usersService.getOnboardingData(req.user.uid);

      if (!result) {
        return {};
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  // Keep the test endpoint for e2e testing
  @Get('test-onboarding/:authId')
  async getOnboardingForTest(@Param('authId') authId: string) {
    try {
      const result = await this.usersService.getOnboardingData(authId);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch('location')
  async updateUserLocation(
    @Req() req,
    @Body() updateUserLocationDto: UpdateUserLocationDto,
  ) {
    return this.usersService.updateUserLocation(
      req.user.uid,
      updateUserLocationDto,
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
