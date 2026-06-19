import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { AttributionService } from './attribution.service';
import { CreateAttributionDto } from './dto/create-attribution.dto';

@Controller('attribution')
export class AttributionController {
  constructor(private readonly attributionService: AttributionService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  create(@Req() req, @Body() dto: CreateAttributionDto) {
    return this.attributionService.create(req.user.uid, dto);
  }
}
