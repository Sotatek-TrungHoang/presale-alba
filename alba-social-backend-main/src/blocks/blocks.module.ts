import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BlocksService } from './blocks.service';
import { BlocksController } from './blocks.controller';
import { FirebaseService } from 'src/firebase/firebase.service';

@Module({
  imports: [PrismaModule],
  providers: [BlocksService, FirebaseService],
  controllers: [BlocksController],
  exports: [BlocksService],
})
export class BlocksModule {}
