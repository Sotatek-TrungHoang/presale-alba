# Alba Social Backend - Code Standards & Architecture

## Overview

Alba Social Backend follows NestJS modular architecture with strict TypeScript conventions, dependency injection, and layered service-controller design. All code must prioritize readability, testability, and maintainability.

---

## NestJS Architecture Principles

### Module Structure

Every feature module follows this pattern:

```
feature/
├── feature.module.ts           # Module definition & imports
├── feature.controller.ts       # HTTP request handling
├── feature.service.ts          # Business logic
├── feature.controller.spec.ts  # Controller tests
├── feature.service.spec.ts     # Service tests
├── dto/
│   ├── create-feature.dto.ts   # Input validation
│   └── update-feature.dto.ts
└── entities/
    └── feature.entity.ts       # Response schema
```

### Dependency Injection

Use NestJS DI container exclusively. Inject dependencies via constructor:

```typescript
@Injectable()
export class GameService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private stripe: StripeService,
  ) {}
}
```

**Never** directly instantiate services:
```typescript
// WRONG
const prisma = new PrismaService();

// RIGHT
constructor(private prisma: PrismaService) {}
```

---

## TypeScript Conventions

### Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Classes | PascalCase | `GameService`, `FirebaseAuthGuard` |
| Functions/Methods | camelCase | `createGame()`, `approvePlayer()` |
| Variables | camelCase | `gameId`, `playerStatus`, `paymentAmount` |
| Constants | UPPER_SNAKE_CASE | `MAX_PLAYERS`, `PAYMENT_HOLD_DAYS` |
| Enums | PascalCase | `GameStatus`, `PlayerType` |
| Files | kebab-case | `game-service.ts`, `firebase-auth.guard.ts` |
| Directories | kebab-case | `src/stripe/`, `src/image-processing/` |

### Type Declarations

**Always declare types.** Never use `any`:

```typescript
// WRONG
const game = getGame();  // type is any

// RIGHT
const game: Game = getGame();
const players: GamePlayer[] = getGamePlayers();
const status: GameStatus = GameStatus.READY_TO_BOOK;
```

### Optional & Nullable

Use `?` for optional, but prefer explicit null handling:

```typescript
// Okay for simple cases
const photoUrl?: string;

// Better: explicit null handling
const photoUrl: string | null = null;

// Avoid: don't confuse optional with nullable
interface User {
  id: string;           // required
  name?: string;        // optional (can be missing from object)
  email: string | null; // nullable (explicitly null)
}
```

### Generics

Use generics for reusable types, especially in service methods:

```typescript
async paginate<T>(
  query: PaginationQuery,
  findFn: (skip: number, take: number) => Promise<T[]>,
): Promise<PaginationResult<T>> {
  const items = await findFn(query.skip, query.take);
  return { items, total: items.length };
}
```

---

## Service Layer

### Responsibilities

A service handles:
- **Business logic:** Game recommendations, payment holds, status transitions
- **Data access:** Prisma queries (never raw SQL unless critical performance)
- **External integrations:** Stripe API calls, Firebase verification, S3 uploads
- **Validation:** Check invariants, enforce constraints

A service does NOT:
- **Handle HTTP:** No response objects, status codes, headers
- **Authenticate:** Authentication is handled by guards
- **Format responses:** Controllers format for HTTP

### Service Methods

Keep methods focused (single responsibility):

```typescript
@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  // Single responsibility: create game
  async createGame(dto: CreateGameDto, creatorId: string): Promise<Game> {
    return this.prisma.game.create({
      data: {
        creator_id: creatorId,
        date: dto.date,
        time_slot: dto.time_slot,
        players_needed: dto.players_needed,
        players_current: 0,
        initial_players_needed: dto.players_needed,
        status: GameStatus.PLAYERS_REQUIRED,
        // ... other fields
      },
    });
  }

  // Single responsibility: validate status transition
  private validateStatusTransition(
    current: GameStatus,
    next: GameStatus,
  ): void {
    const validTransitions: Record<GameStatus, GameStatus[]> = {
      [GameStatus.PLAYERS_REQUIRED]: [GameStatus.READY_TO_BOOK],
      [GameStatus.READY_TO_BOOK]: [GameStatus.READY],
      [GameStatus.READY]: [GameStatus.COMPLETED],
      [GameStatus.COMPLETED]: [],
      [GameStatus.CANCELLED]: [],
    };

    if (!validTransitions[current].includes(next)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
    }
  }

  // Single responsibility: approve player
  async approvePlayer(gameId: string, userId: string): Promise<GamePlayer> {
    const gamePlayer = await this.prisma.gamePlayer.findUnique({
      where: { user_id_game_id: { game_id: gameId, user_id: userId } },
    });

    if (!gamePlayer) {
      throw new NotFoundException('Player not found in game');
    }

    return this.prisma.gamePlayer.update({
      where: { id: gamePlayer.id },
      data: { status: PlayerStatus.APPROVED, has_approved: true },
    });
  }
}
```

### Error Handling

Throw NestJS HTTP exceptions:

```typescript
// WRONG
throw new Error('User not found');

// RIGHT
throw new NotFoundException('User not found');
throw new BadRequestException('Invalid game status');
throw new ConflictException('User already joined game');
throw new ForbiddenException('Only organizer can approve players');
throw new InternalServerErrorException('Stripe API error');
```

**Common exceptions:**
- `NotFoundException`: 404 (resource not found)
- `BadRequestException`: 400 (validation error, invalid input)
- `UnauthorizedException`: 401 (auth required)
- `ForbiddenException`: 403 (auth succeeded but no permission)
- `ConflictException`: 409 (state conflict, e.g., duplicate join)
- `InternalServerErrorException`: 500 (unrecoverable error)

### Transactions

Use Prisma transactions for multi-step operations:

```typescript
async processGameCompletion(gameId: string) {
  return this.prisma.$transaction(async (prisma) => {
    // 1. Mark game as completed
    const game = await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.COMPLETED },
    });

    // 2. Calculate payouts
    const players = await prisma.gamePlayer.findMany({
      where: { game_id: gameId, status: PlayerStatus.APPROVED },
    });

    // 3. Create payout transactions
    for (const player of players) {
      await prisma.transaction.create({
        data: {
          type: TransactionType.PAYOUT,
          status: TransactionStatus.PENDING,
          amount: game.cost_per_player,
          game_id: gameId,
          user_id: player.user_id,
        },
      });
    }

    return game;
  });
}
```

---

## Controller Layer

### Responsibilities

A controller handles:
- **Route mapping:** @Get, @Post, @Patch, @Delete decorators
- **Input/output formatting:** DTOs, response schemas
- **Guard enforcement:** @UseGuards decorators
- **HTTP semantics:** Status codes, headers, redirects

A controller does NOT:
- **Business logic:** Delegate to service
- **Database queries:** Use injected service
- **External calls:** Use injected service

### Controller Methods

Keep controllers thin:

```typescript
@Controller('games')
export class GamesController {
  constructor(private readonly gameService: GameService) {}

  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  async getGame(@Param('id') gameId: string): Promise<Game> {
    return this.gameService.getGameById(gameId);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(201)
  async createGame(
    @Body() dto: CreateGameDto,
    @Request() req: { user: { uid: string } },
  ): Promise<Game> {
    return this.gameService.createGame(dto, req.user.uid);
  }

  @Patch(':id/approve-player')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async approvePlayer(
    @Param('id') gameId: string,
    @Body('player_id') playerId: string,
  ): Promise<GamePlayer> {
    return this.gameService.approvePlayer(gameId, playerId);
  }
}
```

### Response Formatting

Use entity classes for response schemas:

```typescript
// game.entity.ts
export class GameEntity {
  id: string;
  name?: string;
  date: Date;
  time_slot: TimeSlot;
  status: GameStatus;
  players_current: number;
  players_needed: number;
  cost_per_player?: number;
  created_at: Date;
  updated_at: Date;
}

// game.controller.ts
@Get(':id')
@UseGuards(FirebaseAuthGuard)
async getGame(@Param('id') gameId: string): Promise<GameEntity> {
  return this.gameService.getGameById(gameId);
}
```

---

## Data Transfer Objects (DTOs)

### Validation

Use class-validator decorators on all input DTOs:

```typescript
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGameDto {
  @IsNotEmpty()
  @IsDateString()
  date: string; // ISO 8601 datetime

  @IsEnum(TimeSlot)
  time_slot: TimeSlot;

  @IsNumber()
  @Min(1)
  @Max(4)
  @Type(() => Number)
  players_needed: number;

  @IsEnum(GameType)
  game_type: GameType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_per_player?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  course_id?: string;
}
```

### Transformation

Use class-transformer for automatic conversion:

```typescript
export class ListGamesQueryDto {
  @Type(() => Number)
  @Min(0)
  skip: number = 0;

  @Type(() => Number)
  @Min(1)
  @Max(50)
  take: number = 10;

  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;

  @IsOptional()
  @Type(() => Number)
  max_distance?: number; // in kilometers
}
```

The global ValidationPipe with `transform: true` automatically applies these transformations.

---

## Database & Prisma

### Query Patterns

Always use Prisma for data access (no raw SQL unless critical):

```typescript
// Read
const game = await this.prisma.game.findUnique({
  where: { id: gameId },
  include: { players: true, course: true },
});

// Create
const newGame = await this.prisma.game.create({
  data: {
    creator_id: creatorId,
    date: new Date(dto.date),
    status: GameStatus.PLAYERS_REQUIRED,
    // ...
  },
  include: { creator: true },
});

// Update
const updated = await this.prisma.game.update({
  where: { id: gameId },
  data: { status: GameStatus.READY_TO_BOOK },
});

// Delete (soft delete)
await this.prisma.game.update({
  where: { id: gameId },
  data: { deleted_at: new Date() },
});
```

### Soft Deletes

Always filter `deleted_at IS NULL`:

```typescript
// WRONG: returns deleted records too
const games = await this.prisma.game.findMany();

// RIGHT: filters out soft-deleted records
const games = await this.prisma.game.findMany({
  where: { deleted_at: null },
});
```

For bulk queries, create a reusable filter:

```typescript
private activeOnly(where?: Prisma.GameWhereInput): Prisma.GameWhereInput {
  return {
    ...where,
    deleted_at: null,
  };
}

// Usage
const games = await this.prisma.game.findMany({
  where: this.activeOnly({ status: GameStatus.PLAYERS_REQUIRED }),
});
```

### Database Field Naming

- **Database fields:** snake_case (e.g., `creator_id`, `game_type`, `cost_per_player`)
- **Prisma model properties:** Match database field names exactly
- **API JSON:** camelCase (handled by serialization)

Example Prisma model:

```typescript
model Game {
  id              String   @id @default(cuid())
  creator_id      String
  creator         User     @relation("CreatedGames", fields: [creator_id], references: [id])
  game_type       GameType
  cost_per_player Int?
  players_needed  Int
  initial_players_needed Int // Never edited after creation
  status          GameStatus @default(PLAYERS_REQUIRED)
  payment_status  PaymentStatus @default(PENDING)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  deleted_at      DateTime?
}
```

### Unique Constraints

Use compound unique constraints where appropriate:

```typescript
model Follow {
  id           String @id @default(uuid())
  follower_id  String
  following_id String
  
  @@unique([follower_id, following_id]) // Prevent duplicate follows
}

model GamePlayer {
  id      String @id @default(cuid())
  user_id String
  game_id String
  
  @@unique([user_id, game_id]) // One join per player per game
}
```

### Indexes

Add indexes for frequently queried columns:

```typescript
model User {
  id            String @id @default(uuid())
  auth_id       String @unique
  last_active_at DateTime?
  
  @@index([last_active_at]) // Frequently queried for activity status
}

model Transaction {
  id String @id @default(cuid())
  user_id String?
  game_id String?
  
  @@index([user_id]) // Query transactions by user
  @@index([game_id]) // Query transactions by game
}
```

---

## Authentication & Authorization

### Guards

Use guards for role-based access:

```typescript
@Get('admin/reports')
@UseGuards(FirebaseAuthGuard, AdminGuard)
async getReports(): Promise<Report[]> {
  // Only authenticated admins reach here
}

@Patch(':id/approve-player')
@UseGuards(FirebaseAuthGuard)
async approvePlayer(
  @Param('id') gameId: string,
  @Request() req: { user: { uid: string } },
  @Body() dto: ApprovePlayerDto,
): Promise<GamePlayer> {
  // Only authenticated users reach here
  // Service checks organizer permission
}
```

### Request Object

Access authenticated user info:

```typescript
@Post('games')
@UseGuards(FirebaseAuthGuard)
async createGame(
  @Body() dto: CreateGameDto,
  @Request() req: { user: { uid: string; email?: string } },
): Promise<Game> {
  const userId = req.user.uid; // Firebase UID
  return this.gameService.createGame(dto, userId);
}
```

### Admin Checks

Services should not assume admin status; controllers enforce via guard:

```typescript
// Controller enforces admin via AdminGuard
@Patch('complaints/:id/resolve')
@UseGuards(FirebaseAuthGuard, AdminGuard)
async resolveComplaint(
  @Param('id') complaintId: string,
  @Body() dto: ResolveComplaintDto,
): Promise<Complaint> {
  // At this point, user is confirmed admin
  return this.complaintService.resolveComplaint(complaintId, dto);
}
```

---

## Error Handling

### Global Exception Filter

The SentryExceptionFilter catches all exceptions and optionally sends to Sentry:

```typescript
// shared/sentry.filter.ts
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
    } else {
      // Log to Sentry if 5xx
      Sentry.captureException(exception);
      response.status(500).json({ message: 'Internal server error' });
    }
  }
}
```

### Service-Level Validation

Validate business logic constraints:

```typescript
async approvePlayer(gameId: string, userId: string): Promise<GamePlayer> {
  const game = await this.prisma.game.findUnique({
    where: { id: gameId },
    include: { players: { where: { deleted_at: null } } },
  });

  if (!game) {
    throw new NotFoundException('Game not found');
  }

  if (game.status !== GameStatus.PLAYERS_REQUIRED && 
      game.status !== GameStatus.READY_TO_BOOK) {
    throw new BadRequestException(`Cannot approve players in ${game.status} status`);
  }

  const gamePlayer = await this.prisma.gamePlayer.findUnique({
    where: { user_id_game_id: { user_id: userId, game_id: gameId } },
  });

  if (!gamePlayer) {
    throw new NotFoundException('Player not found in game');
  }

  if (gamePlayer.status === PlayerStatus.APPROVED) {
    throw new ConflictException('Player already approved');
  }

  return this.prisma.gamePlayer.update({
    where: { id: gamePlayer.id },
    data: { status: PlayerStatus.APPROVED, has_approved: true },
  });
}
```

---

## Testing

### Test Structure

Follow Arrange-Act-Assert (AAA) pattern:

```typescript
describe('GameService', () => {
  let service: GameService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameService, PrismaService],
    }).compile();

    service = module.get<GameService>(GameService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('approvePlayer', () => {
    it('should approve a pending player', async () => {
      // Arrange
      const gameId = 'game-123';
      const userId = 'user-456';
      jest.spyOn(prisma.gamePlayer, 'findUnique').mockResolvedValueOnce({
        id: 'gp-1',
        user_id: userId,
        game_id: gameId,
        status: PlayerStatus.PENDING,
        has_approved: false,
        // ... other fields
      });

      jest.spyOn(prisma.gamePlayer, 'update').mockResolvedValueOnce({
        id: 'gp-1',
        user_id: userId,
        game_id: gameId,
        status: PlayerStatus.APPROVED,
        has_approved: true,
        // ... other fields
      });

      // Act
      const result = await service.approvePlayer(gameId, userId);

      // Assert
      expect(result.status).toBe(PlayerStatus.APPROVED);
      expect(result.has_approved).toBe(true);
    });

    it('should throw NotFoundException if player not found', async () => {
      // Arrange
      jest.spyOn(prisma.gamePlayer, 'findUnique').mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.approvePlayer('game-123', 'user-456'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

### Mocking

Mock external dependencies:

```typescript
// Mock Stripe service
const mockStripeService = {
  createPaymentIntent: jest.fn().mockResolvedValue({
    id: 'pi_123',
    amount: 10000,
    status: 'succeeded',
  }),
};

// Inject mock into test module
const module: TestingModule = await Test.createTestingModule({
  providers: [
    GameService,
    { provide: StripeService, useValue: mockStripeService },
    PrismaService,
  ],
}).compile();
```

### Test Coverage

- **Unit tests:** Test service methods in isolation
- **E2E tests:** Test full request/response cycle via HTTP
- **Target:** >60% coverage (`npm run test:cov`)

---

## Code Style

### Formatting

- **Prettier** formats code automatically
- **ESLint** catches style violations
- Run before commit: `npm run lint` and `npm run format`

### Comments

Keep comments minimal. Code should be self-documenting:

```typescript
// WRONG: Obvious comment
const gameId = game.id; // Get the game ID

// RIGHT: No comment needed (self-documenting)
const gameId = game.id;

// GOOD: Explains non-obvious business logic
// Game status must transition through READY_TO_BOOK before READY
// to ensure organizer has booked the course and locked in the time
this.validateStatusTransition(current, next);
```

### Function Length

Keep functions short (< 20 lines ideal, < 30 lines max):

```typescript
// TOO LONG: Multiple concerns mixed
async joinGame(gameId: string, userId: string): Promise<GamePlayer> {
  const game = await this.prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new NotFoundException();
  if (game.status !== GameStatus.PLAYERS_REQUIRED) throw new BadRequestException();
  
  const player = await this.prisma.gamePlayer.findUnique({
    where: { user_id_game_id: { user_id: userId, game_id: gameId } },
  });
  if (player) throw new ConflictException();

  const newPlayer = await this.prisma.gamePlayer.create({
    data: { user_id: userId, game_id: gameId, status: PlayerStatus.PENDING },
  });

  // Update game player count
  const updatedGame = await this.prisma.game.update({
    where: { id: gameId },
    data: { players_current: game.players_current + 1 },
  });

  return newPlayer;
}

// BETTER: Extracted helpers
async joinGame(gameId: string, userId: string): Promise<GamePlayer> {
  this.validateGameExists(gameId);
  this.validateGameAcceptsPlayers(gameId);
  this.validatePlayerNotAlreadyJoined(gameId, userId);
  
  return this.createGamePlayer(gameId, userId);
}

private validateGameExists(gameId: string): Promise<Game> { /* ... */ }
private validateGameAcceptsPlayers(gameId: string): void { /* ... */ }
private validatePlayerNotAlreadyJoined(gameId: string, userId: string): void { /* ... */ }
private createGamePlayer(gameId: string, userId: string): Promise<GamePlayer> { /* ... */ }
```

### Class Size

Keep classes small (< 200 lines, < 10 public methods):

If a class exceeds these limits, split into multiple classes:

```typescript
// Split: Combine recommendations into separate service
@Injectable()
export class GameService {
  constructor(
    private prisma: PrismaService,
    private recommendations: GameRecommendationService,
  ) {}

  async getRecommendedGames(userId: string): Promise<Game[]> {
    return this.recommendations.getRecommendedGames(userId);
  }
}

@Injectable()
export class GameRecommendationService {
  // Handle all recommendation logic
}
```

---

## SOLID Principles

### Single Responsibility

Each class has one reason to change:

```typescript
// WRONG: Multiple responsibilities
export class GameController {
  // Recommendation logic (not controller concern)
  calculateDistance(lat1, lng1, lat2, lng2) { }
  filterByPreferences(games, user) { }

  @Get('recommendations')
  async getRecommendations(@Query() query) {
    const games = await this.gameService.getAllGames();
    const filtered = this.filterByPreferences(games, query.user);
    return filtered.sort((a, b) => this.calculateDistance(a, b));
  }
}

// RIGHT: Each class has one responsibility
@Controller('games')
export class GamesController {
  constructor(private gameService: GameService) {}

  @Get('recommendations')
  async getRecommendations(
    @Query() query: GetRecommendationsQuery,
    @Request() req,
  ): Promise<GameEntity[]> {
    return this.gameService.getRecommendedGames(req.user.uid, query);
  }
}

@Injectable()
export class GameService {
  constructor(
    private prisma: PrismaService,
    private recommendations: GameRecommendationService,
  ) {}

  async getRecommendedGames(userId: string, query): Promise<Game[]> {
    return this.recommendations.getRecommendedGames(userId, query);
  }
}

@Injectable()
export class GameRecommendationService {
  constructor(private prisma: PrismaService) {}

  async getRecommendedGames(userId: string, query): Promise<Game[]> {
    // Recommendation algorithm
  }

  private calculateDistance(lat1, lng1, lat2, lng2): number { /* ... */ }
  private filterByPreferences(games, user): Game[] { /* ... */ }
}
```

### Open/Closed

Classes should be open for extension, closed for modification:

```typescript
// Use strategy pattern for flexible behavior
interface RecommendationStrategy {
  score(game: Game, user: User): number;
}

@Injectable()
export class LocationBasedStrategy implements RecommendationStrategy {
  score(game: Game, user: User): number {
    // Calculate location-based score
  }
}

@Injectable()
export class PreferenceBasedStrategy implements RecommendationStrategy {
  score(game: Game, user: User): number {
    // Calculate preference-based score
  }
}

@Injectable()
export class GameRecommendationService {
  constructor(
    private prisma: PrismaService,
    private strategies: RecommendationStrategy[],
  ) {}

  async getRecommendedGames(userId: string): Promise<Game[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const allGames = await this.prisma.game.findMany();

    const scored = allGames.map(game => ({
      game,
      score: this.strategies.reduce((sum, s) => sum + s.score(game, user), 0),
    }));

    return scored.sort((a, b) => b.score - a.score).map(s => s.game);
  }
}
```

### Dependency Inversion

Depend on abstractions, not concrete implementations:

```typescript
// WRONG: Depends on concrete StripeService
@Injectable()
export class PaymentService {
  constructor(private stripe: StripeService) {}
}

// RIGHT: Depends on PaymentProcessor interface
interface PaymentProcessor {
  createPaymentIntent(amount: number): Promise<PaymentIntent>;
}

@Injectable()
export class StripeProcessor implements PaymentProcessor {
  // Stripe implementation
}

@Injectable()
export class PaymentService {
  constructor(@Inject('PaymentProcessor') private processor: PaymentProcessor) {}
}
```

---

## Logging & Monitoring

### Logging

Use NestJS Logger:

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class GameService {
  private logger = new Logger(GameService.name);

  async createGame(dto: CreateGameDto, creatorId: string): Promise<Game> {
    this.logger.log(`Creating game by user ${creatorId}`);

    try {
      const game = await this.prisma.game.create({
        data: { /* ... */ },
      });

      this.logger.log(`Game ${game.id} created successfully`);
      return game;
    } catch (error) {
      this.logger.error(
        `Failed to create game: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
```

### Sentry Monitoring

- 5xx errors automatically captured
- Production: 10% trace sampling
- Development: Disabled by default (enable with SENTRY_DEBUG=true)

See shared/sentry.config.ts for configuration.

---

## Summary Checklist

- [ ] All types declared (no `any`)
- [ ] NestJS DI used exclusively
- [ ] Controllers are thin (delegate to services)
- [ ] Services handle business logic
- [ ] DTOs with class-validator decorators
- [ ] Soft deletes respected (deleted_at IS NULL)
- [ ] Database field names are snake_case
- [ ] Unique constraints for data integrity
- [ ] Guards enforce authorization
- [ ] HTTP exceptions used for errors
- [ ] Comments explain non-obvious logic
- [ ] Functions < 30 lines
- [ ] Classes < 200 lines, < 10 methods
- [ ] Tests use AAA pattern
- [ ] SOLID principles followed
- [ ] Prettier & ESLint pass (`npm run lint`)
