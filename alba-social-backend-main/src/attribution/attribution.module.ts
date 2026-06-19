import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseService } from 'src/firebase/firebase.service';
import { AttributionService } from './attribution.service';
import { AttributionController } from './attribution.controller';
import { GoController } from './go.controller';

@Module({
  imports: [PrismaModule],
  providers: [AttributionService, FirebaseService],
  controllers: [AttributionController, GoController],
  exports: [AttributionService],
})
export class AttributionModule {}
