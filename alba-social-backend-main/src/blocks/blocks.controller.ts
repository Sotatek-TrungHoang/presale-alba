import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { BlocksService } from './blocks.service';
import { BlockUserDto } from './dto/block-user.dto';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  block(@Req() req, @Body() dto: BlockUserDto) {
    return this.blocksService.block(req.user.uid, dto.userId);
  }

  @UseGuards(FirebaseAuthGuard)
  @Delete(':userId')
  unblock(@Req() req, @Param('userId') userId: string) {
    return this.blocksService.unblock(req.user.uid, userId);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get()
  list(@Req() req) {
    return this.blocksService.list(req.user.uid);
  }
}
