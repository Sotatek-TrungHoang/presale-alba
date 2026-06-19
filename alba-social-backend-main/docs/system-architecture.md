# Alba Social Backend - System Architecture

## High-Level Overview

Alba Social Backend is a NestJS REST API supporting a golf social networking platform. The architecture follows a modular, layered design with clear separation between HTTP handling (controllers), business logic (services), and data access (Prisma ORM).

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile & Web Clients                     │
│              (Expo iOS/Android, Web Browser)                 │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/HTTPS
                     │ Bearer Token (Firebase JWT)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  NestJS REST API (Port 3000)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            HTTP Controllers & Guards                  │  │
│  │  ├─ auth, users, profiles, relationships              │  │
│  │  ├─ games, courses, locations                         │  │
│  │  ├─ stripe (payments & webhooks)                      │  │
│  │  ├─ posts, groups, leaderboards                       │  │
│  │  ├─ conversations, messages                           │  │
│  │  ├─ notifications, complaints, reports               │  │
│  │  └─ admin, images, attribution                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Business Logic Services                   │  │
│  │  ├─ GameService (recommendation, status transitions)  │  │
│  │  ├─ StripeService (Connect, payments, holds)         │  │
│  │  ├─ NotificationsService (Expo push)                 │  │
│  │  ├─ GameRecommendationService (location, prefs)      │  │
│  │  ├─ ComplaintService (disputes & resolution)         │  │
│  │  └─ [Other domain services]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         WebSocket Gateway (Socket.IO)                │  │
│  │         Real-time Chat & Notifications               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      Global Exception Filter + Sentry Integration    │  │
│  │      Logging, Error Monitoring, Tracing              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────┬───────────────────────┬───────────────────┘
                 │                       │
      ┌──────────▼──────┐      ┌────────▼──────────┐
      │                 │      │                   │
      ▼                 ▼      ▼                   ▼
  PostgreSQL      Stripe API  Firebase Admin  AWS S3
  (Prisma ORM)    + Webhooks  SDK (Auth)      (Images)
                  + Connect
                  
  Plus: Google Maps, Mapbox, Expo Push, Anthropic Claude API
```

---

## Architectural Layers

### 1. HTTP Layer (Controllers)

**Responsibility:** Handle HTTP requests/responses, route mapping, input/output formatting.

**Components:**
- `src/{feature}/{feature}.controller.ts` (32+ controllers across all domains)
- `src/guards/firebase-auth.guard.ts` (JWT validation)
- `src/guards/admin.guard.ts` (role-based access)
- `src/main.ts` (app bootstrap, middleware setup)

**Key Behaviors:**
- Extract request data (params, query, body)
- Apply guards (@UseGuards) for authentication/authorization
- Delegate business logic to services
- Return formatted responses via DTOs

**Example Flow:**
```
POST /games → GamesController.createGame()
  → FirebaseAuthGuard validates JWT
  → ValidationPipe validates CreateGameDto
  → GamesController calls GameService.createGame()
  → GameService returns Game object
  → Controller returns HTTP 201 + Game JSON
```

### 2. Business Logic Layer (Services)

**Responsibility:** Implement domain-specific logic, validate invariants, coordinate external integrations.

**Components:**
- `src/{feature}/{feature}.service.ts` (core logic for each domain)
- `src/stripe/stripe.service.ts` (Stripe Connect, payments, webhooks)
- Game recommendation algorithms (GameRecommendationService)
- Notification delivery (NotificationsService)
- Complaint resolution (ComplaintService)

**Key Behaviors:**
- CRUD operations via Prisma
- State machine transitions (e.g., Game status workflow)
- External API calls (Stripe, Firebase, S3, Google Maps, Expo)
- Data validation and constraint enforcement
- Transactional operations for multi-step workflows

**Example: Game Workflow**
```
createGame()
  ├─ Validate DTO
  ├─ Create Game record (status: PLAYERS_REQUIRED)
  └─ Create Game-specific Conversation

approvePlayer()
  ├─ Find game & player
  ├─ Validate game status & player status
  ├─ Update GamePlayer (status: APPROVED)
  ├─ Increment game.players_current
  ├─ Check if players_current >= players_needed
  ├─ If ready, update game status → READY_TO_BOOK
  └─ Broadcast notification via WebSocket

processGameCompletion()
  ├─ Update game status → COMPLETED
  ├─ Calculate and create Transaction records (payouts)
  ├─ Stripe Transfer → Organizer Connect account
  ├─ Hold funds for 2 days (dispute resolution)
  └─ Queue Payout after hold period
```

### 3. Data Access Layer (Prisma ORM)

**Responsibility:** Abstraction over PostgreSQL database.

**Components:**
- `src/prisma/prisma.service.ts` (singleton connection manager)
- `prisma/schema.prisma` (data model definition, 993 lines)
- `prisma/migrations/` (schema version history)

**Key Patterns:**
- All queries via Prisma (no raw SQL except performance-critical queries)
- Soft deletes via `deleted_at` field (all queries filter WHERE deleted_at IS NULL)
- Transactions for multi-step operations
- Indexes on foreign keys and frequently queried columns
- Unique constraints for data integrity

**Core Models (32 entities):**
- Users & Profiles: User, Profile, UserOnboarding, UserAvailability, UserLocation
- Games: Game, GamePlayer, Conversation (game-specific chat)
- Payments: StripeAccount, Transaction, TransactionEventLog, PaymentStatus
- Social: Post, Round, Like, Comment, Follow, Group, GroupMember
- Courses: GolfCourse, CourseTee, CourseHole, CourseReview, CourseCondition
- Notifications: PushToken, Notification, NotificationDelivery, NotificationSettings
- Moderation: Block, Report, Complaint
- Leaderboards: LeagueMatch, LeaguePlayer, LeagueMatchPlayer
- Marketing: Attribution, LinkClick

### 4. WebSocket Layer (Socket.IO Gateway)

**Responsibility:** Real-time bidirectional communication for chat and live notifications.

**Components:**
- `src/websockets/chat.gateway.ts` (connection handler, message routing)
- `src/websockets/chat.service.ts` (message persistence, conversation queries)

**Key Behaviors:**
- **Connection:** User authenticates via JWT, joins conversation namespace
- **Message Delivery:** Broadcast to all participants in real-time
- **Persistence:** Store message in database via Chat Service
- **Read Receipts:** Track last_read timestamp per ConversationParticipant

**Message Flow:**
```
Client sends message via WebSocket
  ↓
ChatGateway.handleMessage()
  ├─ Validate user & conversation access
  ├─ Create Message record (via ChatService)
  ├─ Broadcast to all connected participants
  └─ Return delivery confirmation
  
Server sends notification via WebSocket
  ↓
NotificationsService.sendPushAndWebSocket()
  ├─ Send Expo push to devices
  ├─ Broadcast to connected user via WebSocket
  └─ Store delivery record
```

### 5. External Integrations

#### Stripe (Payment Processing)
- **Flow:** Player → Stripe Checkout → PaymentIntent → Charge → Transfer (organizer Connect) → Hold (2 days) → Payout
- **Webhook Handling:** `POST /stripe/webhook/*` endpoints process:
  - Account events (onboarding, verification, payouts enabled)
  - Payment events (charge succeeded, refund)
  - Transfer and payout events
- **Models:** StripeAccount, Transaction, TransactionEventLog
- **Key Detail:** Application fee collected on each payment; funds held 2 days for dispute resolution

#### Firebase Admin SDK
- **Purpose:** Validate JWT tokens from mobile/web clients
- **Flow:** Client includes Bearer token → FirebaseAuthGuard.verifyIdToken() → Extract uid/email → Inject into request
- **Files:** `src/firebase/firebase.service.ts`, `src/guards/firebase-auth.guard.ts`

#### AWS S3 (Image Storage)
- **Purpose:** Store uploaded images (posts, profiles)
- **Flow:** Client calls `POST /images/upload` → Generate presigned URL → Client uploads directly to S3 → Store URL in Image model
- **Files:** `src/images/images.service.ts`

#### Google Maps API & Mapbox
- **Purpose:** Location services, geocoding, nearby search
- **Usage:** Game location search, course location validation, distance calculations
- **Files:** `src/locations/locations.service.ts`

#### Expo Server SDK (Push Notifications)
- **Purpose:** Send push notifications to iOS/Android devices
- **Flow:** Store PushToken → NotificationsService.sendPush() → Expo API → Device → Store NotificationDelivery record
- **Files:** `src/notifications/notifications.service.ts`
- **Async Status:** Expo ticket-based async delivery, status polled separately

#### Anthropic Claude API
- **Purpose:** Potential AI features (detected in package.json, not yet integrated)
- **Files:** None yet; ready for future AI-powered matching/recommendations

---

## Request/Response Flow (Example: Create Game)

```
1. Client sends:
   POST /games
   Authorization: Bearer <Firebase-JWT>
   Content-Type: application/json
   {
     "date": "2026-06-25T09:00:00Z",
     "time_slot": "EARLY_MORNING",
     "players_needed": 4,
     "game_type": "RELAXED_ROUND",
     "cost_per_player": 5000
   }

2. NestJS Entry Point (main.ts):
   ├─ Sentry initialized (error tracking)
   ├─ Global ValidationPipe active (transforms + validates)
   ├─ Raw body parsing enabled (Stripe webhooks)
   └─ CORS enabled

3. Controller Layer (GamesController):
   ├─ @UseGuards(FirebaseAuthGuard) validates JWT
   ├─ @Body() dto triggers ValidationPipe
   │   ├─ Transform string types (date → DateTime)
   │   ├─ Validate enum values (TimeSlot, GameType)
   │   └─ Check @Min/@Max/@IsNotEmpty constraints
   ├─ Extract user.uid from request
   └─ Call gameService.createGame(dto, userId)

4. Business Logic (GameService):
   ├─ Validate user exists
   ├─ Validate game details (date in future, valid location, etc.)
   ├─ Prisma.game.create() with transaction
   │   ├─ Create Game record
   │   ├─ Set status: PLAYERS_REQUIRED
   │   ├─ Set initial_players_needed (immutable, for fill rate calc)
   │   └─ Create associated Conversation (game chat)
   └─ Return Game object

5. Response (Controller):
   ├─ Format Game object via GameEntity DTO
   └─ Return HTTP 201 + JSON:
      {
        "id": "game-uuid",
        "creator_id": "user-uuid",
        "date": "2026-06-25T09:00:00Z",
        "time_slot": "EARLY_MORNING",
        "status": "PLAYERS_REQUIRED",
        "players_current": 0,
        "players_needed": 4,
        "game_type": "RELAXED_ROUND",
        "cost_per_player": 5000,
        "created_at": "2026-06-19T...",
        "updated_at": "2026-06-19T..."
      }

6. Error Handling (if any):
   ├─ Validation error → ValidationPipe → HTTP 400
   ├─ Not found error → Service throws NotFoundException → HTTP 404
   ├─ Conflict error → Service throws ConflictException → HTTP 409
   ├─ Unhandled error → SentryExceptionFilter captures → Sentry + HTTP 500
   └─ Response JSON: { "statusCode": 400, "message": "...", "error": "..." }
```

---

## Payment & Stripe Flow (Complex Workflow)

```
PHASE 1: Game Setup
  └─ Organizer creates game with total_cost and cost_per_player

PHASE 2: Player Enrollment
  ├─ Players join game (GamePlayer records, status: PENDING)
  ├─ Organizer approves players (GamePlayer.status: APPROVED)
  └─ Once enough approved, game.status → READY_TO_BOOK

PHASE 3: Course Booking
  ├─ Organizer books course off-app
  ├─ Updates game with exact_time
  └─ Game.status → READY

PHASE 4: Payment Collection
  ├─ Organizer requests payment split
  ├─ For each approved player:
  │   ├─ Create Stripe PaymentIntent
  │   ├─ Player completes checkout
  │   ├─ Stripe charges player account
  │   ├─ Application fee deducted (platform revenue)
  │   ├─ Remainder transferred to organizer's Stripe Connect account
  │   ├─ Create Transaction record (type: PAYMENT_INTENT_CHARGE)
  │   ├─ Create TransactionEventLog (audit trail)
  │   └─ GamePlayer.has_paid = true
  └─ When all paid, Game.payment_status → FULLY_PAID

PHASE 5: Dispute Hold Period
  ├─ All funds held in organizer's Stripe Connect balance for 2 days
  ├─ Window for players to file complaints
  └─ Complaint creation prevents payout until resolved

PHASE 6: Game Completion & Payout
  ├─ 2 days after game date (or complaint resolved)
  ├─ StripeService.processPayout()
  │   ├─ Create Stripe Payout (Connect account → organizer bank)
  │   ├─ Create Transaction record (type: PAYOUT)
  │   ├─ Game.payout_completed = true
  │   └─ Game.payout_date = now
  └─ Organizer receives funds in bank account (1-2 business days)

DISPUTE FLOW (Alternative):
  ├─ Player files complaint (type: ORGANISER_DID_NOT_BOOK, etc.)
  ├─ Complaint.status = PENDING
  ├─ Admin reviews complaint
  ├─ If valid: Issue refund
  │   ├─ Create Stripe Refund for charged amount
  │   ├─ Create Transaction (type: REFUND)
  │   ├─ Deduct from organizer's Connect balance
  │   ├─ Complaint.status = REFUNDED
  │   └─ Player receives refund in original payment method
  └─ If invalid: Reject complaint & process normal payout
```

**Data Models Involved:**
- Game: total_cost, cost_per_player, payment_status, stripe_session_id, payout_completed, payout_date
- GamePlayer: has_paid, payment_amount, payment_date, stripe_payment_id, refunded, refund_date
- StripeAccount: user's Stripe Connect account (Express/Custom)
- Transaction: Complete payment record with all Stripe object IDs
- TransactionEventLog: Audit trail of webhook events
- Complaint: Dispute tracking, resolution, refund processing

---

## Data Model Overview (32 Entities)

### User & Profile Management
| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| User | Central identity | id (UUID), auth_id (Firebase), admin_status, stripe_customer_id, deleted_at |
| Profile | User details | user_id (FK), first_name, last_name, photo, address, handicap, lat/lng |
| UserOnboarding | Signup preferences | user_id (FK), handicap_range, player_type, game_preferences, completed |
| UserAvailability | Available time slots | onboarding_id (FK), time_slots array |
| UserLocation | Latest location | user_id (FK), lat, lng |
| Attribution | Marketing source | user_id (FK), method, first_touch, last_touch (JSON) |

### Game Management
| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| Game | Game posting | id, creator_id, course_id, status, date, time_slot, players_current, players_needed, game_type, cost_per_player, payment_status, payout_* |
| GamePlayer | Join/approval | id, user_id, game_id, status (PENDING/APPROVED/REJECTED/INVITED), has_paid, payment_* |
| Conversation | Game chat | id, game_id, type (DIRECT/GROUP/GAME), participants |

### Payments & Transactions
| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| StripeAccount | Connect account | user_id (FK), stripe_connect_id, account_type (EXPRESS/CUSTOM), details_submitted, payouts_enabled, pending/previous_connect_id (for migration) |
| Transaction | Payment record | id, type (PAYMENT_INTENT_CHARGE/TRANSFER/REFUND/PAYOUT), status, amount, user_id, game_id, stripe_payment_intent_id, stripe_refund_id, stripe_payout_id, metadata |
| TransactionEventLog | Webhook audit | id, transaction_id (FK), stripe_event_id, stripe_event_type, details (JSON) |

### Social Features
| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| Post | Social post | id, user_id, group_id, type (GENERAL/SCORE), content, images |
| Image | Post image | id, post_id (FK), url (S3) |
| Round | Golf scorecard | id, post_id (1-to-1), course_id, tee_id, scores (JSON) |
| PlayerScore | Individual scores | id, round_id, user_id, scores (JSON array), total, againstPar |
| Like | Post like | id, user_id, post_id (unique constraint) |
| Comment | Post comment | id, user_id, post_id, content |
| Follow | Follower relationship | id, follower_id, following_id (unique constraint) |

### Groups & Courses
| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| Group | Social group | id, name, description, banner, image, isPublic |
| GroupMember | Group member | id, user_id, group_id, role (ADMIN/MEMBER) |
| GolfCourse | Course | id, name, lat/lng, address, saturday_9am_cost_pence, is_bookable, booking_url |
| CourseTee | Course tee | id, course_id, tee_name, rating, slope |
| CourseHole | Hole data | id, tee_id, number, yards, par, handicap |
| CourseReview | Course review | id, course_id, user_id, rating, comment |
| CourseCondition | Course condition report | id, course_id, user_id, condition, details |
| FavouriteCourse | Favorite course | id, user_id, course_id (unique constraint) |

### Notifications & Moderation
| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| PushToken | Device token | id, user_id, token, platform (ios/android), is_active |
| Notification | Notification | id, user_id, title, body, type (GAME/CHAT/FOLLOW/GENERAL), read |
| NotificationDelivery | Delivery attempt | id, notification_id, push_token_id, token, ticket_id (Expo), status (PENDING/SENT/ERROR) |
| NotificationSettings | Notification prefs | user_id (FK), game_notifications, chat_notifications, follow_notifications, general_notifications |
| Block | User block | id, blocker_id, blocked_id (unique constraint) |
| Report | Content report | id, reporter_id, target_type (USER/CONVERSATION/GAME), target_user/conversation/game_id, reason, status |
| Complaint | Game complaint | id, game_id, complainant_id, type (ORGANISER_DID_NOT_BOOK/GAME_CANCELLED_WITHOUT_NOTICE/OTHER), status, resolver_id, resolution |

### League & Rankings
| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| League | League | id, name, startDate, endDate, divisions |
| Division | Division | id, league_id, name, players, matches |
| LeaguePlayer | Player in division | id, user_id, division_id |
| LeagueMatch | Match | id, division_id, course_id, date, completed |
| LeagueMatchPlayer | Match participation | id, match_id, player_id, score |

### Enumerations

**GameStatus:** PLAYERS_REQUIRED, READY_TO_BOOK, READY, COMPLETED, CANCELLED  
**PlayerStatus:** PENDING (join request), APPROVED, REJECTED, INVITED  
**InviteStatus:** PENDING, ACCEPTED, DECLINED, NOT_INVITED  
**PaymentStatus:** PENDING, PARTIALLY_PAID, FULLY_PAID, REFUNDED, CANCELLED  
**TransactionType:** PAYMENT_INTENT_CHARGE, APPLICATION_FEE, TRANSFER, REFUND, PAYOUT  
**TransactionStatus:** PENDING, SUCCEEDED, FAILED, PROCESSING, CANCELED, REQUIRES_ACTION  
**GameType:** PURELY_SOCIAL, RELAXED_ROUND, COMPETITIVE_MATCH, BEGINNER_FRIENDLY  
**GameFormat:** MATCHPLAY, STROKEPLAY, SCRAMBLE, STABLEFORD, BEST_BALL  
**TimeSlot:** EARLY_MORNING, LATE_MORNING, LUNCHTIME, LATE_AFTERNOON, EVENING  
**HandicapRange:** LOW, MID, HIGH, DONT_KNOW  
**PlayerType:** CASUAL_PLAYER, DEDICATED_IMPROVER, SERIOUS_COMPETITOR, NEW_TO_GOLF  
**ConversationType:** DIRECT, GROUP, GAME  
**PostType:** GENERAL, SCORE  
**StripeAccountType:** EXPRESS, CUSTOM  

---

## Key Design Decisions

### 1. Soft Deletes via deleted_at
**Rationale:** Preserves referential integrity and audit trail. Deleted records remain queryable for reporting.  
**Trade-off:** All queries must filter `WHERE deleted_at IS NULL`; complicates migrations.  
**Alternative Considered:** Hard deletes (rejected due to audit/compliance needs).

### 2. Stripe Connect with 2-Day Hold
**Rationale:** Allows dispute resolution window post-game; reduces chargeback risk.  
**Trade-off:** Organizers receive funds 2+ days after game (not immediate).  
**Alternative Considered:** Immediate payouts (rejected due to dispute risk).

### 3. Immutable initial_players_needed
**Rationale:** Measure fill rate against original target even if players_needed is later adjusted.  
**Trade-off:** Slightly more database storage.  
**Alternative Considered:** Recalculate fill rate from history (more complex).

### 4. Transaction + TransactionEventLog
**Rationale:** Separate event audit trail from transaction state. Ensures idempotent webhook processing.  
**Trade-off:** Two-table join for complete audit trail.  
**Alternative Considered:** Single table with event array (less queryable).

### 5. Unique Constraints on Social Relationships
**Rationale:** Database-level enforcement prevents duplicates (Follow, Like, etc.).  
**Trade-off:** Requires handling unique violation errors in code.  
**Alternative Considered:** Application-level checks (slower, less reliable).

### 6. Game-Specific Conversations
**Rationale:** Centralizes game chat in Conversation model rather than separate GameChat table.  
**Trade-off:** Requires nullable game_id in Conversation (pollutes direct message queries).  
**Alternative Considered:** Separate GameChat table (more tables, less unified).

---

## Performance Considerations

### Indexes
- Foreign keys (user_id, game_id, course_id, etc.)
- Frequently queried columns (last_active_at, created_at, status)
- Unique constraints (Follow, Like, GamePlayer)

### Query Patterns
- **List games by status:** `WHERE status = ? AND deleted_at IS NULL ORDER BY created_at DESC`
- **Nearby games:** Requires spatial index or post-query filtering (Google Maps API)
- **User's followed posts:** JOIN Post on Follow relationship
- **Game recommendation:** In-memory filtering (strategies apply scoring)

### Pagination
- All list endpoints use skip/take (offset-based)
- Limit: max 50 items per page
- Default: 10 items per page

### Caching
- Global cache manager configured (no expiration by default)
- Used for course listings, leaderboards (optional)

---

## Security Considerations

### Authentication
- Firebase ID token verification (JWT)
- Token extracted from `Authorization: Bearer <token>` header
- Verified via Firebase Admin SDK before each request

### Authorization
- Role-based access control (AdminGuard checks admin_status)
- Resource ownership checks in services (e.g., only organizer can approve players)

### Data Protection
- HTTPS enforced in production
- Sensitive fields not logged (passwords, payment details)
- Stripe API keys in environment variables (not committed)

### Webhook Signature Verification
- Stripe webhooks verified via signature (raw body required)
- Prevents webhook spoofing

### CORS
- Enabled for web clients
- Configurable origin list (should be restricted in production)

---

## Deployment Architecture

```
┌─────────────────────────────────────┐
│     Deployment Environment          │
│  (Docker, Kubernetes, or VM)        │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │   NestJS Application Container  │ │
│ │   ├─ Node.js runtime             │ │
│ │   ├─ npm dependencies            │ │
│ │   ├─ Prisma client               │ │
│ │   └─ Port 3000 exposed           │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Configuration & Secrets             │
│ ├─ .env file (environment variables)│
│ ├─ DATABASE_URL                     │
│ ├─ FIREBASE_PRIVATE_KEY             │
│ ├─ STRIPE_SECRET_KEY                │
│ └─ [Other secrets]                  │
├─────────────────────────────────────┤
│ Services & Data Stores              │
│ ├─ PostgreSQL database              │
│ ├─ Redis (optional, for caching)    │
│ └─ Sentry (error tracking)          │
└─────────────────────────────────────┘

External Services (via HTTPS):
├─ Firebase (auth)
├─ Stripe (payments)
├─ AWS S3 (image storage)
├─ Google Maps (location)
├─ Expo (push notifications)
└─ Mapbox (geocoding)
```

**Docker Setup:**
- Dockerfile provided (see dockerfile)
- docker-run.sh script for local development
- Prisma migration runs before app start (docker-entrypoint.sh)

**Deployment Steps:**
1. Build Docker image
2. Set environment variables
3. Run database migrations (`prisma migrate deploy`)
4. Start application (`npm run start:prod`)
5. Verify Swagger at `/api`

---

## Monitoring & Observability

### Logging
- NestJS Logger used throughout services
- Logs to stdout (captured by container orchestration)
- Log level configurable via NODE_ENV

### Error Tracking
- Sentry integration for 5xx errors
- 10% trace sampling in production (100% in development)
- Request/response tracing enabled
- Performance profiling optional

### Health Checks
- `/health` endpoint (if implemented)
- Database connectivity check
- External service health (Stripe, Firebase, S3)

### Metrics
- API response time (via Sentry tracing)
- Database query performance
- Stripe webhook processing time
- Push notification delivery rate

---

## Scalability Considerations

### Horizontal Scaling
- Stateless app design (no in-memory sessions)
- Session management via JWT (no server-side session storage)
- Real-time chat can scale via Redis adapter (Socket.IO)

### Database Scaling
- Read replicas for read-heavy queries
- Connection pooling (Prisma handles via PrismaService)
- Index optimization for frequently accessed columns

### Caching Strategy
- Course listings (rarely change)
- Leaderboards (computed periodically)
- User availability preferences (read-heavy)

### Asynchronous Processing
- Scheduled notifications via cron (separate process)
- Webhook event processing (retry logic, idempotency)
- Image processing (could be offloaded to Lambda/Cloud Functions)

---

## Disaster Recovery

### Database Backup
- PostgreSQL automated backups (via managed service or scheduled dumps)
- Retention: 30 days minimum
- Test restore procedures regularly

### Secrets Management
- Environment variables encrypted at rest
- Rotation: every 90 days or after compromise
- Audit access to secrets

### Failover
- Database: Standby replica with automatic failover
- App: Multiple app instances behind load balancer
- External services: Graceful degradation if unavailable

---

## Development Workflow

```
1. Feature Branch:
   git checkout -b feature/new-game-type

2. Local Development:
   npm install
   docker-compose up (PostgreSQL)
   npm run start:dev

3. Database Changes:
   npx prisma migrate dev --name add_new_field
   (Creates migration file in prisma/migrations/)

4. Testing:
   npm run test (unit tests)
   npm run test:e2e (integration tests)
   npm run test:cov (coverage report)

5. Code Quality:
   npm run lint (ESLint + Prettier)
   npm run format (Prettier auto-fix)

6. Commit & Push:
   git add .
   git commit -m "feat: add new game type"
   git push origin feature/new-game-type

7. Pull Request:
   - Code review
   - CI/CD tests
   - Merge to main

8. Deployment:
   - Automated via CI/CD pipeline
   - Database migrations applied
   - New version deployed
```

---

## Conclusion

Alba Social Backend is a modular, scalable NestJS API with clear separation of concerns. Controllers handle HTTP, services implement business logic, and Prisma manages data access. Stripe integration handles complex payment workflows with dispute resolution. Real-time chat via Socket.IO keeps users connected. Comprehensive error tracking via Sentry ensures reliability. The architecture supports the core golf social networking use case: users onboard, post games, join games, pay, and receive payouts—all while staying connected via real-time chat and notifications.
