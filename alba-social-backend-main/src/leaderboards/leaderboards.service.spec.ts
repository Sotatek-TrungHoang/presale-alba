import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardsService } from './leaderboards.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeaderboardsService', () => {
  let service: LeaderboardsService;

  const mockPrismaService = {
    playerScore: {},
    user: {},
    game: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LeaderboardsService>(LeaderboardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
