import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GoogleMapsService } from 'src/shared/services/google-maps.service';
import { FirebaseService } from 'src/firebase/firebase.service';

@Module({
  imports: [PrismaModule],
  controllers: [CoursesController],
  providers: [CoursesService, GoogleMapsService, FirebaseService],
  exports: [CoursesService],
})
export class CoursesModule {}
