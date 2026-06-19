import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  create(@Req() req, @Body() dto: CreateReportDto) {
    return this.reportsService.create(req.user.uid, dto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get()
  list(@Req() req, @Query('status') status?: string) {
    return this.reportsService.list(req.user.uid, status as any);
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch(':id')
  resolve(@Req() req, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.reportsService.resolve(req.user.uid, id, dto);
  }
}
