import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseService } from 'src/firebase/firebase.service';
import { CoursesModule } from 'src/courses/courses.module';

@Module({
  imports: [UsersModule, PrismaModule, CoursesModule],
  controllers: [AuthController],
  providers: [AuthService, UsersService, FirebaseService],
})
export class AuthModule {}
