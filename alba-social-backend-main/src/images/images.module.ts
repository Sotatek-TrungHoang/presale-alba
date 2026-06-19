import { Module } from '@nestjs/common';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { FirebaseService } from 'src/firebase/firebase.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService, FirebaseService],
})
export class ImagesModule {}
