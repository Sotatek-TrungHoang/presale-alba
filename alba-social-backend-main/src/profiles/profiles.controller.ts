import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { UserProfileDto } from './dto/user-profile.dto';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profilesService.create(createProfileDto);
  }

  @Get()
  findAll() {
    return this.profilesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profilesService.findOne(+id);
  }
  /**
   * User Profile endpoints (unified API)
   */
  @UseGuards(FirebaseAuthGuard)
  @Get('user-profile')
  getUserProfile(@Request() req) {
    return this.profilesService.getUserProfile(req.user.uid);
  }

  /**
   * Check if a user has completed the onboarding process
   */
  @UseGuards(FirebaseAuthGuard)
  @Get('onboarding-status')
  async getOnboardingStatus(@Request() req) {
    const profile = await this.profilesService.getUserProfile(req.user.uid);
    return { onboardingCompleted: profile.onboardingCompleted };
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch('user-profile')
  updateUserProfile(@Request() req, @Body() profileData: UserProfileDto) {
    return this.profilesService.updateUserProfile(req.user.uid, profileData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.profilesService.remove(+id);
  }
}
