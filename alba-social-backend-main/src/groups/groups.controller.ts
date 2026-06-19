import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JoinLeaveGroupDto } from './dto/join-leave-group.dto';
import { SearchGroupsDto } from './dto/search-groups.dto';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  async createGroup(@Request() req, @Body() createGroupDto: CreateGroupDto) {
    return this.groupsService.createGroup(req.user.uid, createGroupDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('join')
  async joinGroup(@Request() req, @Body() joinGroupDto: JoinLeaveGroupDto) {
    return this.groupsService.joinGroup(req.user.uid, joinGroupDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('leave')
  async leaveGroup(@Request() req, @Body() leaveGroupDto: JoinLeaveGroupDto) {
    return this.groupsService.leaveGroup(req.user.uid, leaveGroupDto);
  }

  @Get('search')
  searchGroups(@Query() searchGroupsDto: SearchGroupsDto) {
    return this.groupsService.searchGroups(searchGroupsDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(id);
  }

  @Get(':id/game-requests')
  findGameRequests(@Param('id') id: string) {
    return this.groupsService.findUpcomingGames(id);
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch(':id')
  update(@Request() req, @Body() updateGroupDto: UpdateGroupDto) {
    return this.groupsService.updateGroup(req.user.uid, updateGroupDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.groupsService.remove(+id);
  }
}
