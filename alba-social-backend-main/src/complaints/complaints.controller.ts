import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Get,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import { ComplaintsService, CreateComplaintDto } from './complaints.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post('games/:gameId')
  @UseGuards(FirebaseAuthGuard)
  async createComplaint(
    @Request() req,
    @Param('gameId') gameId: string,
    @Body() createComplaintDto: CreateComplaintDto,
  ) {
    return this.complaintsService.createComplaint(
      req.user.uid,
      gameId,
      createComplaintDto,
    );
  }

  @Get('games/:gameId')
  @UseGuards(FirebaseAuthGuard)
  async getGameComplaints(@Request() req, @Param('gameId') gameId: string) {
    return this.complaintsService.getGameComplaints(gameId);
  }

  @Patch(':complaintId/resolve')
  @UseGuards(FirebaseAuthGuard)
  async resolveComplaint(
    @Request() req,
    @Param('complaintId') complaintId: string,
    @Body() resolveComplaintDto: ResolveComplaintDto,
  ) {
    return this.complaintsService.resolveComplaint(
      req.user.uid,
      complaintId,
      resolveComplaintDto,
    );
  }
}
