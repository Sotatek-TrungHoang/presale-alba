import { Module } from '@nestjs/common';
import { V1GamesController } from './games/games.controller';
import { V1GamesService } from './games/games.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseService } from 'src/firebase/firebase.service';
import { StripeModule } from 'src/stripe/stripe.module';

@Module({
  imports: [PrismaModule, StripeModule],
  controllers: [V1GamesController],
  providers: [V1GamesService, FirebaseService],
})
export class V1Module {}
