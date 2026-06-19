# Alba Social Backend - Codebase Summary

**Generated:** June 2026  
**Framework:** NestJS 10 + TypeScript 5  
**Database:** PostgreSQL with Prisma ORM  
**API Style:** REST with Swagger documentation  
**Total Source Files:** ~211 TypeScript files  
**Code Lines:** ~993 lines Prisma schema + application code across 32+ modules

---

## Module Inventory

### Core Infrastructure

#### `src/main.ts` (47 lines)
Application bootstrap entry point. Configures:
- Sentry error tracking (initialized before app creation)
- Raw body parsing for Stripe webhook signature verification
- Global ValidationPipe with implicit type conversion
- Swagger API documentation at `/api`
- CORS enablement
- Static assets serving from `public/`
- Server listens on port 3000

#### `src/app.module.ts` (78 lines)
Root application module. Imports all feature modules:
- Prisma, Auth, Users, Profiles, Relationships
- Games, Courses, Locations, Stripe
- Posts, Groups, Leaderboards
- Conversations, Messages, WebSockets (Chat)
- Images, Image Processing
- Notifications, Complaints, Reports, Blocks
- Attribution, Admin, V1 versioning
- Global exception filter for Sentry

#### `src/prisma/` (3 files)
**PrismaService:** Singleton database service for all ORM access. Implements `OnModuleInit` and `OnModuleDestroy` for connection lifecycle.

### Authentication & Authorization

#### `src/auth/` (4 files, ~150 LOC)
- **firebase-auth.guard.ts:** Guard for protected endpoints. Extracts Bearer token from Authorization header, validates via Firebase Admin SDK, injects `user` object (uid, email, emailVerified) into request.
- **admin.guard.ts:** Checks user's `admin_status` field for admin-only endpoints
- **auth.service.ts:** Firebase token verification, user record creation/lookup
- **auth.controller.ts:** Public endpoints for login/signup

#### `src/firebase/` (1-2 files)
Firebase Admin SDK initialization and service for JWT validation.

#### `src/guards/` (firebase-auth.guard.ts, admin.guard.ts)
See auth/ above.

### User Management

#### `src/users/` (~200 LOC)
- **users.service.ts:** CRUD operations on User model. Soft deletes via `deleted_at`.
- **users.controller.ts:** Endpoints for user profile, activity status, user search
- **DTOs:** create-user.dto.ts, update-user.dto.ts with class-validator decorators

#### `src/profiles/` (~200 LOC)
- **profiles.service.ts:** Profile-specific operations (photo, location, handicap)
- **profiles.controller.ts:** GET/PATCH profile endpoints
- Linked to User via one-to-one Profile relation

#### `src/relationships/` (~200 LOC)
- **relationships.service.ts:** Follow/unfollow logic, follower/following queries
- **relationships.controller.ts:** GET follows, POST/DELETE follow relationships
- Uses Follow model with unique constraint on (follower_id, following_id)

### Game Management

#### `src/games/` (~400-500 LOC)
One of the largest modules. Core features:
- **games.service.ts:** Game CRUD, recommendation algorithm, status state machine
  - `createGame()`: Validates game details, sets initial status PLAYERS_REQUIRED
  - `recommendGames()`: Filters by user preferences, location, availability (strategy pattern)
  - `updateGameStatus()`: Transitions between status states
  - `approvePlayer()`, `rejectPlayer()`: Player management
  - `getGameByStatus()`: Query games by lifecycle stage
- **games.controller.ts:** REST endpoints for all game operations
- **DTOs:** create-game.dto.ts, update-game.dto.ts with game_type, game_format, cost_per_player validation
- **Enums in schema:** GameStatus, GameType, GameFormat, PaymentStatus, TimeSlot, HandicapRange

**Game Workflow (from schema/README):**
1. User posts game (PLAYERS_REQUIRED)
2. Players join (GamePlayer records created, status PENDING)
3. Organizer approves players (status → APPROVED)
4. Once enough approved, game → READY_TO_BOOK
5. Organizer books round off-app, updates exact_time
6. Game → READY
7. Players submit payment (Stripe checkout)
8. Game → COMPLETED after event
9. Organizer requests payout (held 2 days for disputes)

#### `src/courses/` (~300 LOC)
- **courses.service.ts:** Course CRUD, search, filtering, reviews, condition reporting
- **courses.controller.ts:** List courses, get course details, POST reviews/conditions
- **Course models:** GolfCourse, CourseTee, CourseHole, CourseReview, CourseCondition, FavouriteCourse
- Supports course tee selection (White/Yellow/Red with ratings/slopes)

#### `src/locations/` (~200 LOC)
- **locations.service.ts:** Location-based queries (nearby courses, users)
- **locations.controller.ts:** GET locations, update user location
- Uses Google Maps API and Mapbox for geocoding
- UserLocation model stores latest known lat/lng

### Payment & Stripe

#### `src/stripe/` (~600+ LOC)
Large and complex module for payment processing:
- **stripe.service.ts:** Core Stripe operations
  - Account onboarding (Express/Custom account types)
  - Payment intent creation
  - Transfer management (platform → organizer)
  - Webhook event processing
  - 2-day hold calculation for dispute resolution
- **stripe.controller.ts:** Webhook endpoints for Stripe events
  - `/stripe/webhook/account`: Stripe Connect account events
  - `/stripe/webhook/payment`: Payment intent, charge, refund events
- **DTOs:** create-payment.dto.ts with amount, game_id, player_id validation
- **Models:** StripeAccount, Transaction, TransactionEventLog
  - Transaction tracks payment_intent, charges, refunds, transfers, payouts with full Stripe object IDs
  - TransactionEventLog stores each Stripe webhook event for audit trail
  - StripeAccount handles Express → Custom migration, pending_connect_id, previous_connect_id

**Key Details (from schema & STRIPE_WEBHOOKS.md):**
- Funds held 2 days post-game for dispute resolution
- Application fee charged on every payment
- Stripe Connect used for direct organizer payouts
- Webhook signature verification (raw body requirement)

#### `src/transactions/` (optional)
May be a service or part of stripe/. Transaction model handles:
- PAYMENT_INTENT_CHARGE, APPLICATION_FEE, REFUND, TRANSFER, PAYOUT
- Full Stripe object ID tracking for reconciliation
- Event-based status updates (SUCCEEDED, FAILED, PROCESSING)

### Social Features

#### `src/posts/` (~250 LOC)
- **posts.service.ts:** Create, update, delete posts. Support GENERAL and SCORE post types.
- **posts.controller.ts:** Endpoints for post CRUD, like, comment
- **Models:** Post, Image, Like, Comment
- Image relation: Post has many Images (linked to S3 URLs)
- Likes and Comments use unique constraints to prevent duplicates

#### `src/leaderboards/` (~200 LOC)
- **leaderboards.service.ts:** Calculate rankings by handicap, scores, game participation
- **leaderboards.controller.ts:** GET leaderboard with filters
- May include batch refresh logic for large player sets
- Uses PlayerScore model (aggregate from Round → scores)

#### `src/groups/` (~200 LOC)
- **groups.service.ts:** Group CRUD, member management, role-based access (ADMIN/MEMBER)
- **groups.controller.ts:** Endpoints for groups, members, invites
- **Models:** Group, GroupMember
- Groups can have associated Conversation for group chat

#### `src/round/` (~50-100 LOC)
Golf round tracking:
- **round.controller.ts:** Endpoints for round creation/updates
- **Models:** Round (linked to Post via one-to-one), Course, CourseTee, PlayerScore, UnassignedScore
- Stores individual hole scores, total, and against-par calculation

### Real-Time Communication

#### `src/websockets/` (~300+ LOC)
Socket.IO gateway for live messaging:
- **chat.gateway.ts:** WebSocket connection handler
  - Handles @SubscribeMessage events for message delivery
  - Broadcasts to conversation participants
  - Real-time delivery without polling
- **chat.service.ts:** Message persistence and conversation queries
- **chat.module.ts:** Wires gateway with PrismaModule

#### `src/conversations/` (~200 LOC)
- **conversations.service.ts:** Conversation CRUD (direct, group, game)
- **conversations.controller.ts:** Endpoints for conversation list, details
- **Models:** Conversation (type: DIRECT/GROUP/GAME), ConversationParticipant, Message
- last_read timestamp for read receipts

#### `src/messages/` (~150 LOC)
- **messages.service.ts:** Message CRUD
- **messages.controller.ts:** Endpoints for message history, search
- Persists all messages to database via Conversation relation

### Notifications

#### `src/notifications/` (~250 LOC)
Push notifications via Expo Server SDK:
- **notifications.service.ts:** Send push notifications, track delivery
  - Queries PushToken for user's devices
  - Calls Expo API with message payload
  - Stores NotificationDelivery record with ticket_id
- **notifications.controller.ts:** Endpoints for notification history, preferences
- **Models:** PushToken, Notification, NotificationDelivery, NotificationSettings
- Delivery status tracking: PENDING, SENT, ERROR (with error_code/message)

#### `src/cron/` (~100+ LOC)
Scheduled tasks (see CRON.md):
- **scheduled-notifications.runner.js:** Batch notification sender
  - Runs on schedule (time configurable)
  - Queries pending notifications
  - Sends via Expo, updates delivery status
- Invoked via `npm run cron:notifications` or scheduled in deployment (systemd/cron)

### Content Moderation

#### `src/blocks/` (~150 LOC)
User blocking:
- **blocks.service.ts:** Block/unblock users
- **blocks.controller.ts:** Endpoints for block list, manage blocks
- **Model:** Block (blocker_id, blocked_id) with unique constraint
- Enforced in queries (e.g., exclude blocked users from message lists)

#### `src/complaints/` (~200 LOC)
Game dispute handling:
- **complaints.service.ts:** Create complaint, admin resolution
  - Types: ORGANISER_DID_NOT_BOOK, GAME_CANCELLED_WITHOUT_NOTICE, OTHER
  - Statuses: PENDING, IN_REVIEW, RESOLVED, REFUNDED, REJECTED
- **complaints.controller.ts:** Endpoints to file/resolve complaints
- **Model:** Complaint links Game, complainant User, resolver User
- Linked to Transaction for refund processing

#### `src/reports/` (~200 LOC)
Content reporting:
- **reports.service.ts:** Report users, conversations, games
  - ReportTargetType: USER, CONVERSATION, GAME
  - ReportReason: SPAM, HARASSMENT, HATE_SPEECH, NSFW, SCAM, OTHER
  - ReportStatus: PENDING, REVIEWED, ACTIONED, DISMISSED
- **reports.controller.ts:** Endpoints to file/review reports
- Admin visible for moderation action

### Images & File Storage

#### `src/images/` (~200 LOC)
Image upload and management:
- **images.service.ts:** Upload to S3, generate presigned URLs
  - Uses AWS SDK client-s3 and s3-presigned-post
  - Returns URL for image asset linking
- **images.controller.ts:** POST upload, GET signed URLs
- Image model links to Post (one-to-many)

#### `src/image-processing/` (~100 LOC)
Image optimization (optional):
- **image-processing.service.ts:** Resize, compress, apply filters
- May defer to lambda or background job for large images

### Admin & Attribution

#### `src/admin/` (~150 LOC)
Admin-only operations:
- **admin.service.ts:** Complaint resolution, refund issuance, user management
- **admin.controller.ts:** Protected endpoints (requires admin.guard)
- Actions: resolve complaint, refund payment, suspend user, view reports

#### `src/attribution/` (~100 LOC)
Marketing attribution:
- **attribution.service.ts:** Track signup source (campaign, link params)
- **attribution.controller.ts:** Endpoints for attribution data
- **Models:** Attribution (method: email/google/apple, first_touch, last_touch JSON), LinkClick (anonymous web clicks)

### API Versioning

#### `src/v1/` (~50 LOC)
- **v1.module.ts:** Version-specific routing
- Routes API endpoints under `/v1/*` for future versioning
- Allows migration path for breaking changes

### Well-Known & Round Controllers

#### `src/well-known/well-known.controller.ts` (~50 LOC)
- Serves `.well-known/assetlinks.json` for Android app linking
- Public endpoint, no auth required

#### `src/round/round.controller.ts`
See Round module above (golf round endpoints).

### Shared Utilities

#### `src/shared/` (~200+ LOC)
- **sentry.config.ts:** Initialize Sentry for error tracking
  - Captures 5xx errors in production
  - 10% trace sampling in production, 100% in dev
  - Request/response tracing, profiling enabled
  - Smart filtering: 4xx errors stay local
- **sentry.filter.ts:** Global exception filter
  - Catches all unhandled exceptions
  - Reports to Sentry if applicable
  - Returns formatted error response to client
- Other shared utilities (constants, helpers, decorators)

---

## Key Data Model Patterns

### User-Centric Models
- **User:** Central entity with relationships to all features (auth_id, email, admin_status, soft-delete via deleted_at)
- **Profile:** One-to-one with photo, location, contact details, handicap
- **UserOnboarding:** Captures preferences at signup (handicap_range, player_type, game_preferences)
- **UserAvailability:** Time slot preferences (WEEKDAY/WEEKEND × EARLY_MORNING/LATE_MORNING/etc.)
- **UserLocation:** Latest known lat/lng for location-based queries

### Game-Centric Models
- **Game:** Game posting with details (date, time_slot, location, cost, game_type, game_format)
- **GamePlayer:** Join/approval workflow (status: PENDING/APPROVED/REJECTED/INVITED, has_approved, has_paid)
- **Conversation:** Optional game-specific chat channel
- **Complaint:** Dispute tracking post-game

### Financial Models
- **StripeAccount:** Organizer's Stripe Connect account (Express or Custom type, with migration fields)
- **Transaction:** Complete payment record (type, status, amount, all Stripe object IDs)
- **TransactionEventLog:** Audit trail of all webhook events

### Social Models
- **Post:** GENERAL or SCORE type, with Images, Likes, Comments
- **Round:** Golf score post (linked 1-to-1 to Post), stores per-hole and total scores
- **Follow:** Follower/following relationships
- **Group:** Social groups with members and group-specific conversations

### Moderation Models
- **Block:** User blocking (blocker → blocked)
- **Report:** Content reports (target_user_id, target_conversation_id, target_game_id)

### Notification Models
- **PushToken:** Device token registration (ios/android)
- **Notification:** Message to user with type (GAME, CHAT, FOLLOW, GENERAL)
- **NotificationDelivery:** Delivery attempt (status: PENDING/SENT/ERROR, ticket_id from Expo)
- **NotificationSettings:** Per-user preferences for notification types

---

## API Conventions

### Request/Response
- DTOs with class-validator decorators for input validation
- Global ValidationPipe enforces DTO validation
- Implicit type conversion enabled (strings → numbers, booleans)
- snake_case for database fields, camelCase for API JSON

### Authentication
- Bearer token in Authorization header
- Firebase ID token verification in FirebaseAuthGuard
- Admin routes protected by AdminGuard
- No token needed for `/auth/*`, `/well-known/*`, Swagger `/api`

### Error Handling
- NestJS built-in HTTP exceptions (BadRequestException, NotFoundException, etc.)
- Sentry captures all 5xx errors
- Exception filter formats errors consistently
- 4xx errors logged locally, 5xx errors to Sentry

### Database
- All tables include created_at, updated_at timestamps
- Soft deletes via deleted_at field (queries filter by deleted_at IS NULL)
- Indexes on foreign keys and frequently queried columns
- Unique constraints where needed (e.g., Follow, Like, FavouriteCourse)

### Swagger Documentation
- Available at `/api` when running
- DTOs auto-documented via @ApiProperty decorators
- Response schemas generated from TypeScript types

---

## Testing Strategy

- **Unit Tests:** Jest specs (`*.spec.ts`) in each module alongside source
- **E2E Tests:** Jest E2E specs in `/test` directory
- **Coverage:** Target >60%, run with `npm run test:cov`
- **Test Files:** test/*.e2e-spec.ts (user-onboarding, locations, courses-by-location, etc.)

---

## Deployment & Environment

### Build & Run
- `npm run build` → TypeScript compiled to `dist/`
- `npm run start:prod` → Runs `prisma generate`, `npm run build`, then `node dist/main.js`
- `npm run start:dev` → Watch mode with hot reload
- Docker support via Dockerfile and docker-run.sh

### Environment Variables
- DATABASE_URL, FIREBASE_*, STRIPE_*, AWS_*, GOOGLE_MAPS_*, MAPBOX_*, EXPO_*, SENTRY_* (see README.md)
- Never commit `.env` files

### Database
- Migrations in `prisma/migrations/`
- Run with `npx prisma migrate deploy`
- Schema in `prisma/schema.prisma` (993 lines)

---

## Notable Implementation Details

1. **Soft Deletes:** All models use deleted_at timestamp; queries must filter `WHERE deleted_at IS NULL`
2. **Snake_Case Database Fields:** Prisma model properties match database field naming
3. **Stripe Integration:** Full webhook handling with event audit trail (Transaction + TransactionEventLog)
4. **Real-Time Chat:** Socket.IO gateway broadcasts to conversation participants
5. **Game Recommendations:** Strategy pattern allows swappable recommendation algorithms
6. **2-Day Payment Hold:** Post-game funds held for dispute resolution before payout
7. **Push Notifications:** Expo Server SDK with ticket tracking for async delivery status
8. **Activity Tracking:** last_active_at bumped per user (debounced hourly)
9. **Marketing Attribution:** First-touch and last-touch campaign tracking
10. **Leaderboard Calculations:** Aggregate scores via PlayerScore model

---

## Known Limitations & TODOs

- Image processing currently no-op; could add Lambda integration
- Leaderboard refresh may lag for very large player counts
- Complaint resolution currently manual (admin) only
- Push notification delivery not guaranteed (Expo SDK limitation)
- Geographic search bounded by Google Maps API rate limits

---

## File Organization

```
src/
├── main.ts                          # Bootstrap
├── app.module.ts                    # Root module
├── auth/                            # Firebase auth, login/signup
├── users/                           # User CRUD
├── profiles/                        # Profile details
├── relationships/                   # Follow/unfollow
├── games/                           # Game management & recommendations
├── courses/                         # Course database & reviews
├── locations/                       # Location-based services
├── stripe/                          # Payment & Stripe Connect
├── posts/                           # Social posts
├── leaderboards/                    # Ranking calculations
├── groups/                          # Social groups
├── round/                           # Golf round scores
├── websockets/                      # Socket.IO chat gateway
├── conversations/                   # Conversation management
├── messages/                        # Message history
├── notifications/                   # Push notifications
├── cron/                            # Scheduled jobs
├── blocks/                          # User blocking
├── complaints/                      # Game disputes
├── reports/                         # Content reporting
├── images/                          # S3 image upload
├── image-processing/                # Image optimization
├── admin/                           # Admin operations
├── attribution/                     # Marketing attribution
├── v1/                              # API versioning
├── well-known/                      # .well-known endpoints
├── firebase/                        # Firebase SDK setup
├── guards/                          # Auth/admin guards
├── prisma/                          # Database service
├── shared/                          # Shared utilities & Sentry
├── prisma/schema.prisma             # Prisma data model (993 lines)
└── migrations/                      # Database migrations
```

---

## Next Steps for Developers

1. **Setup:** `npm install`, configure `.env`, `npx prisma migrate deploy`
2. **Development:** `npm run start:dev` for watch mode
3. **Testing:** `npm run test` for unit tests, `npm run test:e2e` for E2E
4. **Deployment:** See deployment-guide.md
5. **API Docs:** Browse Swagger at `http://localhost:3000/api`
