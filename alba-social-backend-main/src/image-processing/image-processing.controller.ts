import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ImageProcessingService } from './image-processing.service';
import { CreateImageProcessingDto } from './dto/create-image-processing.dto';
import { UpdateImageProcessingDto } from './dto/update-image-processing.dto';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';

@Controller('image-processing')
export class ImageProcessingController {
  constructor(
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  create(
    @Request() req,
    @Body() createImageProcessingDto: CreateImageProcessingDto,
  ) {
    return this.imageProcessingService.create(
      req.user.uid,
      createImageProcessingDto,
    );
  }
}
