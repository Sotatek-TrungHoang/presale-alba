import { Module } from '@nestjs/common';
import { ImageProcessingService } from './image-processing.service';
import { ImageProcessingController } from './image-processing.controller';
import { FirebaseService } from 'src/firebase/firebase.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [ImageProcessingController],
  providers: [ImageProcessingService, FirebaseService],
})
export class ImageProcessingModule {}
