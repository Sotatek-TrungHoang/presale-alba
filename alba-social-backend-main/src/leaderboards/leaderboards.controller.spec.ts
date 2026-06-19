import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsService } from './leaderboards.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeaderboardsController', () => {
  let controller: LeaderboardsController;

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardsController],
      providers: [
        LeaderboardsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<LeaderboardsController>(LeaderboardsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
