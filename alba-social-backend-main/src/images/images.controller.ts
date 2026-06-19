import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ImagesService } from './images.service';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';
import { GetPresignedUrlDto } from './dto/get-presigned.dto';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  async getPresignedUrl(
    @Request() req,
    @Body() getPresignedUrlDto: GetPresignedUrlDto,
  ) {
    return this.imagesService.getPresignedUrl(req.user.uid, getPresignedUrlDto);
  }
}
