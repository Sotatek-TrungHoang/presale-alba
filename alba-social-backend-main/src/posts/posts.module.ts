import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseService } from 'src/firebase/firebase.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, FirebaseService],
})
export class PostsModule {}
