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
import { RelationshipsService } from './relationships.service';
import { FindFollowStatusDto } from './dto/find-follow-status.dto';
import { FollowUserDto } from './dto/follow-user.dto';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';

@Controller('relationships')
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post('follow')
  followUser(@Request() req, @Body() followUserDto: FollowUserDto) {
    return this.relationshipsService.followUser(
      req.user.uid,
      followUserDto.followingId,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('follow-status/:followingId')
  findFollowStatus(@Request() req, @Param() params: FindFollowStatusDto) {
    return this.relationshipsService.findFollowStatus(
      req.user.uid,
      params.followingId,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Delete('unfollow')
  unfollowUser(@Request() req, @Body() followUserDto: FollowUserDto) {
    return this.relationshipsService.unfollowUser(
      req.user.uid,
      followUserDto.followingId,
    );
  }
}
