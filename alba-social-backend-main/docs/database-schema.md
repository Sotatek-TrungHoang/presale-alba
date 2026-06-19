# Alba Social Backend - Database Schema Overview

**Technology:** PostgreSQL 14+, Prisma ORM  
**Schema File:** `prisma/schema.prisma` (993 lines)  
**Migrations:** `prisma/migrations/` (version-controlled)

---

## Core Entities & Relationships

### User & Authentication

```prisma
model User {
  id                 String    @id @default(uuid())
  auth_id            String    @unique        // Firebase UID
  admin_status       Boolean                   // Admin flag
  email              String?
  stripe_customer_id String?   @unique        // Stripe customer ID
  
  // Relations
  profile              Profile?
  onboarding           UserOnboarding?
  stripe_account       StripeAccount?
  latestLocation       UserLocation?
  
  // Activity tracking
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt
  deleted_at           DateTime?              // Soft delete
  last_active_at       DateTime?
  
  @@index([last_active_at])
}

model Profile {
  id           String    @id @default(uuid())
  user_id      String    @unique
  user         User      @relation(fields: [user_id], references: [id])
  
  // Personal details
  first_name   String?
  last_name    String?
  photo        String?   // S3 URL
  
  // Location
  address_line_1 String?
  address_line_2 String?
  postcode     String?
  city         String?
  country      String?   @default("GB")
  lat          Float?
  lng          Float?
  
  // Golf info
  handicap     Float?
  mobile_number String?
  
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  deleted_at   DateTime?
}

model UserOnboarding {
  id                   String    @id @default(uuid())
  user_id              String    @unique
  user                 User      @relation(fields: [user_id], references: [id])
  
  // Onboarding answers
  handicap_range       HandicapRange      // LOW, MID, HIGH, DONT_KNOW
  player_type          PlayerType         // CASUAL_PLAYER, DEDICATED_IMPROVER, etc.
  preferences          GameType[]         // Array of preferred game types
  onboarding_completed Boolean   @default(false)
  
  // Availability
  availability         UserAvailability?
  
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt
  deleted_at           DateTime?
}

model UserAvailability {
  id            String    @id @default(uuid())
  onboarding_id String    @unique
  onboarding    UserOnboarding @relation(fields: [onboarding_id], references: [id])
  
  time_slots    UserTimeSlot[]
  
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  deleted_at    DateTime?
}

model UserTimeSlot {
  id              String    @id @default(uuid())
  availability_id String
  availability    UserAvailability @relation(fields: [availability_id], references: [id])
  
  day_type        DayType   // WEEKDAY, WEEKEND
  time_slot       TimeSlot  // EARLY_MORNING, LATE_MORNING, LUNCHTIME, LATE_AFTERNOON, EVENING
  
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  deleted_at      DateTime?
  
  @@unique([availability_id, day_type, time_slot])
}

model UserLocation {
  id        String   @id @default(uuid())
  user_id   String   @unique
  user      User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  lat       Float
  lng       Float
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}
```

---

### Games & Players

```prisma
model Game {
  id                   String    @id @default(cuid())
  creator_id           String
  creator              User      @relation("CreatedGames", fields: [creator_id], references: [id])
  
  // Game details
  name                 String?
  date                 DateTime
  time_slot            TimeSlot  // EARLY_MORNING, LATE_MORNING, LUNCHTIME, LATE_AFTERNOON, EVENING
  exact_time           String?   // Set after course booked
  
  // Players
  players_current      Int       // Current player count
  players_needed       Int       // Required player count
  initial_players_needed Int     // Immutable: original target (for fill rate)
  
  // Location & course
  course_id            String?
  course               GolfCourse? @relation(fields: [course_id], references: [id])
  group_id             String?
  group                Group?    @relation(fields: [group_id], references: [id])
  location             String?   // Free-text location
  lat                  Float?
  lng                  Float?
  distance             Int?      // km from user
  
  // Game preferences
  game_type            GameType  // PURELY_SOCIAL, RELAXED_ROUND, COMPETITIVE_MATCH, BEGINNER_FRIENDLY
  game_format          GameFormat? // MATCHPLAY, STROKEPLAY, SCRAMBLE, STABLEFORD, BEST_BALL, DONT_KNOW_YET
  handicap_min         Float?
  handicap_max         Float?
  organiser_handicap   HandicapRange
  
  // Payments
  total_cost           Int?      // Total in cents
  cost_per_player      Int?      // Per player in cents
  payment_status       PaymentStatus @default(PENDING)
  stripe_session_id    String?
  stripe_card_id       String?
  
  // Status & payouts
  status               GameStatus @default(PLAYERS_REQUIRED)
  payout_completed     Boolean   @default(false)
  payout_date          DateTime?
  
  // Relations
  players              GamePlayer[]
  conversation         Conversation?
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt
  deleted_at           DateTime?
}

model GamePlayer {
  id            String    @id @default(cuid())
  user_id       String
  user          User      @relation(fields: [user_id], references: [id])
  game_id       String
  game          Game      @relation(fields: [game_id], references: [id])
  
  // Approval workflow
  status        PlayerStatus @default(PENDING)  // PENDING, APPROVED, REJECTED, INVITED
  has_approved  Boolean   @default(false)
  invite_status InviteStatus @default(NOT_INVITED)
  
  // Payment tracking
  has_paid      Boolean   @default(false)
  payment_amount Int?
  payment_date  DateTime?
  stripe_payment_id String?
  refunded      Boolean   @default(false)
  refund_date   DateTime?
  
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  deleted_at    DateTime?
  
  @@unique([user_id, game_id])
}

enum GameStatus {
  PLAYERS_REQUIRED    // Waiting for players to join
  READY_TO_BOOK       // Enough approved players
  READY               // Course booked, exact time set
  COMPLETED
  CANCELLED
}

enum PlayerStatus {
  PENDING              // Awaiting organizer approval
  APPROVED             // Organizer approved or player accepted invite
  REJECTED             // Organizer rejected or player declined
  INVITED              // Organizer invited player
}

enum InviteStatus {
  PENDING              // Invite sent, awaiting response
  ACCEPTED             // Player accepted invite
  DECLINED             // Player declined invite
  NOT_INVITED          // Player requested to join (default)
}

enum PaymentStatus {
  PENDING
  PARTIALLY_PAID
  FULLY_PAID
  REFUNDED
  CANCELLED
}

enum GameType {
  PURELY_SOCIAL
  RELAXED_ROUND
  COMPETITIVE_MATCH
  BEGINNER_FRIENDLY
}

enum GameFormat {
  MATCHPLAY
  STROKEPLAY
  SCRAMBLE
  STABLEFORD
  BEST_BALL
  DONT_KNOW_YET
}

enum TimeSlot {
  EARLY_MORNING      // 6am-9am
  LATE_MORNING       // 9am-12pm
  LUNCHTIME          // 12pm-3pm
  LATE_AFTERNOON     // 3pm-6pm
  EVENING            // 6pm-9pm
}

enum HandicapRange {
  LOW                // 0-10
  MID                // 11-25
  HIGH               // 26-36
  DONT_KNOW
}

enum PlayerType {
  CASUAL_PLAYER
  DEDICATED_IMPROVER
  SERIOUS_COMPETITOR
  NEW_TO_GOLF
}
```

---

### Courses & Rounds

```prisma
model GolfCourse {
  id                     String    @id @default(uuid())
  name                   String
  lat                    Float?
  lng                    Float?
  address                String?
  saturday_9am_cost_pence Int?
  is_bookable            Boolean   @default(false)
  closed_down            Boolean   @default(false)
  booking_url            String?
  
  reviews                CourseReview[]
  condition_reports      CourseCondition[]
  league_matches         LeagueMatch[]
  favourites             FavouriteCourse[]
  games                  Game[]
  rounds                 Round[]
  tees                   CourseTee[]
  
  created_at             DateTime  @default(now())
  updated_at             DateTime  @updatedAt
  deleted_at             DateTime?
}

model CourseTee {
  id        String    @id @default(uuid())
  course_id String
  course    GolfCourse @relation(fields: [course_id], references: [id])
  
  tee_name  String    // "White", "Yellow", "Red"
  rating    Float?    // Course rating (e.g., 71.0)
  slope     Float?    // Slope rating (e.g., 128)
  
  holes     CourseHole[]
  rounds    Round[]
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  
  @@unique([course_id, tee_name])
}

model CourseHole {
  id        String    @id @default(uuid())
  tee_id    String
  tee       CourseTee @relation(fields: [tee_id], references: [id])
  
  number    Int       // Hole 1-18
  yards     Int
  par       Int
  handicap  Int
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  
  @@unique([tee_id, number])
}

model CourseReview {
  id        String    @id @default(uuid())
  course_id String
  course    GolfCourse @relation(fields: [course_id], references: [id])
  user_id   String
  user      User      @relation(fields: [user_id], references: [id])
  
  rating    Float?
  comment   String?
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}

model CourseCondition {
  id        String    @id @default(uuid())
  course_id String
  course    GolfCourse @relation(fields: [course_id], references: [id])
  reporter  String
  user      User      @relation(fields: [reporter], references: [id])
  
  condition String
  details   String?
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}

model FavouriteCourse {
  id        String    @id @default(uuid())
  user_id   String
  user      User      @relation(fields: [user_id], references: [id])
  course_id String
  course    GolfCourse @relation(fields: [course_id], references: [id])
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  
  @@unique([user_id, course_id])
}

model Round {
  id        String    @id @default(cuid())
  post_id   String    @unique
  post      Post      @relation(fields: [post_id], references: [id])
  
  course_id String
  course    GolfCourse @relation(fields: [course_id], references: [id])
  tee_id    String
  tee       CourseTee @relation(fields: [tee_id], references: [id])
  
  date      DateTime
  
  scores           PlayerScore[]
  unassigned_scores UnassignedScore[]
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}

model PlayerScore {
  id        String    @id @default(cuid())
  round_id  String
  round     Round     @relation(fields: [round_id], references: [id])
  user_id   String
  user      User      @relation(fields: [user_id], references: [id])
  
  scores    Json      // Array of ints and nulls: [5, 4, null, 3, ...]
  total     Int
  againstPar Int
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  
  @@unique([round_id, user_id])
}

model UnassignedScore {
  id        String    @id @default(cuid())
  round_id  String
  round     Round     @relation(fields: [round_id], references: [id])
  
  scores    Json      // Unassigned hole scores
  total     Int
  againstPar Int
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}
```

---

### Payments & Transactions

```prisma
model StripeAccount {
  id                    String    @id @default(uuid())
  user_id               String    @unique
  user                  User      @relation(fields: [user_id], references: [id])
  
  stripe_connect_id     String    @unique
  account_type          StripeAccountType @default(EXPRESS)
  details_submitted     Boolean   @default(false)
  details_submitted_at  DateTime?
  payouts_enabled       Boolean   @default(false)
  
  // Express → Custom migration fields
  pending_connect_id    String?
  previous_connect_id   String?
  previous_account_type StripeAccountType?
  migrated_at           DateTime?
  
  // Issue notification tracking
  last_event_time       DateTime?
  issue_notified_at     DateTime?
  
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime?
}

enum StripeAccountType {
  EXPRESS
  CUSTOM
}

model Transaction {
  id                String    @id @default(cuid())
  
  // Transaction details
  type              TransactionType
  status            TransactionStatus
  amount            Int       // cents/pence
  currency          String    // ISO code
  description       String?
  
  // References
  user_id           String?
  user              User?     @relation(fields: [user_id], references: [id])
  game_id           String?
  game              Game?     @relation(fields: [game_id], references: [id])
  game_player_id    String?
  gamePlayer        GamePlayer? @relation(fields: [game_player_id], references: [id])
  
  // Stripe object IDs
  stripe_payment_intent_id         String?
  stripe_charge_id                 String?
  stripe_refund_id                 String?   @unique
  stripe_payout_id                 String?   @unique
  stripe_transfer_id               String?
  stripe_transfer_reversal_id      String?   @unique
  stripe_balance_transaction_id    String?   @unique
  stripe_application_fee_id        String?   @unique
  stripe_application_fee_refund_id String?   @unique
  stripe_customer_id               String?
  stripe_connected_account_id      String?
  
  // Related transactions
  related_stripe_object_id String?
  
  // Audit trail
  metadata          Json?
  last_event_time   DateTime?
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  deleted_at        DateTime?
  processed_at      DateTime?
  
  event_logs        TransactionEventLog[]
  
  @@unique([stripe_payment_intent_id, type])
}

model TransactionEventLog {
  id                String    @id @default(cuid())
  transaction_id    String
  transaction       Transaction @relation(fields: [transaction_id], references: [id])
  
  stripe_event_id   String    @unique
  stripe_event_type String    // payment_intent.succeeded, refund.updated, etc.
  status            TransactionStatus
  
  details           Json?     // event.data.object
  notes             String?
  
  stripe_event_created_at DateTime
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  deleted_at        DateTime?
}

enum TransactionType {
  PAYMENT_INTENT_CHARGE
  APPLICATION_FEE
  APPLICATION_FEE_REFUND
  TRANSFER
  PAYOUT
  REFUND
  TRANSFER_REVERSAL
  PLATFORM_ADJUSTMENT
}

enum TransactionStatus {
  PENDING
  SUCCEEDED
  FAILED
  PROCESSING
  CANCELED
  REQUIRES_ACTION
  REQUIRES_CAPTURE
}
```

---

### Social Features (Posts, Likes, Comments)

```prisma
model Post {
  id        String    @id @default(uuid())
  user_id   String
  user      User      @relation(fields: [user_id], references: [id])
  group_id  String?
  group     Group?    @relation(fields: [group_id], references: [id])
  
  type      PostType  // GENERAL, SCORE
  content   String?
  
  images    Image[]
  round     Round?    // 1-to-1 if type = SCORE
  likes     Like[]
  comments  Comment[]
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}

enum PostType {
  GENERAL
  SCORE
}

model Image {
  id        String    @id @default(uuid())
  post_id   String
  post      Post      @relation(fields: [post_id], references: [id])
  
  url       String    // S3 URL
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}

model Like {
  id        String    @id @default(cuid())
  user_id   String
  user      User      @relation(fields: [user_id], references: [id])
  post_id   String
  post      Post      @relation(fields: [post_id], references: [id])
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  
  @@unique([user_id, post_id])
}

model Comment {
  id        String    @id @default(cuid())
  user_id   String
  user      User      @relation(fields: [user_id], references: [id])
  post_id   String
  post      Post      @relation(fields: [post_id], references: [id])
  
  content   String
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}

model Follow {
  id           String    @id @default(uuid())
  follower_id  String
  follower     User      @relation("follower", fields: [follower_id], references: [id])
  following_id String
  following    User      @relation("following", fields: [following_id], references: [id])
  
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  deleted_at   DateTime?
  
  @@unique([follower_id, following_id])
}
```

---

### Groups & Messaging

```prisma
model Group {
  id          String    @id @default(uuid())
  name        String
  description String?
  banner      String?   // S3 URL
  image       String?   // S3 URL
  isPublic    Boolean   @default(true)
  
  members     GroupMember[]
  games       Game[]
  posts       Post[]
  conversation Conversation?
  
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  deleted_at  DateTime?
}

model GroupMember {
  id        String    @id @default(uuid())
  user_id   String
  user      User      @relation(fields: [user_id], references: [id])
  group_id  String
  group     Group     @relation(fields: [group_id], references: [id])
  
  role      String    @default("MEMBER") // ADMIN or MEMBER
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}

model Conversation {
  id           String    @id @default(cuid())
  name         String?   // For group conversations
  type         ConversationType
  
  participants ConversationParticipant[]
  messages     Message[]
  
  // Optional relations
  group_id     String?   @unique
  group        Group?    @relation(fields: [group_id], references: [id])
  game_id      String?   @unique
  game         Game?     @relation(fields: [game_id], references: [id])
  
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  deleted_at   DateTime?
  
  @@index([group_id])
}

enum ConversationType {
  DIRECT
  GROUP
  GAME
}

model ConversationParticipant {
  id              String    @id @default(cuid())
  user_id         String
  user            User      @relation(fields: [user_id], references: [id])
  conversation_id String
  conversation    Conversation @relation(fields: [conversation_id], references: [id])
  
  last_read       DateTime? // Read receipt
  
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  deleted_at      DateTime?
  
  @@unique([user_id, conversation_id])
}

model Message {
  id              String    @id @default(cuid())
  content         String
  user_id         String
  user            User      @relation(fields: [user_id], references: [id])
  conversation_id String
  conversation    Conversation @relation(fields: [conversation_id], references: [id])
  
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  deleted_at      DateTime?
}
```

---

### Notifications & Moderation

```prisma
model PushToken {
  id        String    @id @default(cuid())
  user_id   String
  user      User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  token     String    @unique
  platform  String    // "ios" or "android"
  is_active Boolean   @default(true)
  
  deliveries NotificationDelivery[]
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  
  @@index([user_id])
}

model Notification {
  id        String    @id @default(cuid())
  user_id   String
  user      User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  title     String
  body      String
  data      Json?     // Additional context
  type      NotificationType
  read      Boolean   @default(false)
  
  deliveries NotificationDelivery[]
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  
  @@index([user_id])
  @@index([user_id, read])
  @@index([type])
}

enum NotificationType {
  GAME
  CHAT
  FOLLOW
  GENERAL
}

model NotificationDelivery {
  id              String    @id @default(cuid())
  notification_id String
  notification    Notification @relation(fields: [notification_id], references: [id], onDelete: Cascade)
  
  push_token_id   String?
  push_token      PushToken? @relation(fields: [push_token_id], references: [id], onDelete: SetNull)
  
  token           String    // Snapshot of token at send time
  ticket_id       String?   // Expo ticket ID
  status          NotificationDeliveryStatus @default(PENDING)
  
  error_code      String?   // Expo error
  error_message   String?
  
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  
  @@index([notification_id])
  @@index([ticket_id])
  @@index([status])
}

enum NotificationDeliveryStatus {
  PENDING
  SENT
  ERROR
}

model NotificationSettings {
  id                    String    @id @default(cuid())
  user_id               String    @unique
  user                  User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  game_notifications    Boolean   @default(true)
  chat_notifications    Boolean   @default(true)
  follow_notifications  Boolean   @default(true)
  general_notifications Boolean   @default(true)
  
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime?
  
  @@index([user_id])
}

model Block {
  id        String    @id @default(cuid())
  blocker_id String
  blocker   User      @relation("Blocker", fields: [blocker_id], references: [id])
  blocked_id String
  blocked   User      @relation("Blocked", fields: [blocked_id], references: [id])
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  
  @@unique([blocker_id, blocked_id])
}

model Report {
  id              String    @id @default(cuid())
  reporter_id     String
  reporter        User      @relation("UserReports", fields: [reporter_id], references: [id])
  
  target_type     ReportTargetType
  target_user_id  String?
  target_conversation_id String?
  target_game_id  String?
  
  reason          ReportReason
  description     String?
  status          ReportStatus @default(PENDING)
  moderation_action String?
  
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  deleted_at      DateTime?
  
  @@index([reporter_id])
  @@index([target_user_id])
}

enum ReportTargetType {
  USER
  CONVERSATION
  GAME
}

enum ReportReason {
  SPAM
  HARASSMENT
  HATE_SPEECH
  NSFW
  SCAM
  OTHER
}

enum ReportStatus {
  PENDING
  REVIEWED
  ACTIONED
  DISMISSED
}

model Complaint {
  id             String    @id @default(cuid())
  game_id        String
  game           Game      @relation(fields: [game_id], references: [id])
  
  complainant_id String
  complainant    User      @relation("ComplaintComplainant", fields: [complainant_id], references: [id])
  
  type           ComplaintType
  description    String
  status         ComplaintStatus @default(PENDING)
  
  resolved_by    String?
  resolver       User?     @relation("ComplaintResolver", fields: [resolved_by], references: [id])
  resolution     String?
  
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt
  deleted_at     DateTime?
  
  @@index([game_id])
}

enum ComplaintType {
  ORGANISER_DID_NOT_BOOK
  GAME_CANCELLED_WITHOUT_NOTICE
  OTHER
}

enum ComplaintStatus {
  PENDING
  IN_REVIEW
  RESOLVED
  REFUNDED
  REJECTED
}
```

---

### Marketing & Attribution

```prisma
model Attribution {
  id         String    @id @default(uuid())
  user_id    String
  user       User      @relation(fields: [user_id], references: [id])
  
  method     String    // "email", "google", "apple"
  
  // Campaign touch data (JSON for flexibility)
  first_touch Json?    // { campaign, source, medium, ... }
  last_touch  Json?
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  
  @@index([user_id])
}

model LinkClick {
  id        String    @id @default(uuid())
  
  // UTM parameters
  source    String?
  medium    String?
  campaign  String?
  content   String?
  term      String?
  ref       String?
  
  params    Json?     // Full query string
  user_agent String?
  referer   String?
  
  created_at DateTime  @default(now())
  
  @@index([campaign])
  @@index([created_at])
}
```

---

### Leagues (Optional Feature)

```prisma
model League {
  id          String    @id @default(uuid())
  name        String
  banner      String?
  image       String?
  description String?
  startDate   DateTime
  endDate     DateTime
  
  divisions   Division[]
  
  createdAt   DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  deleted_at  DateTime?
}

model Division {
  id         String    @id @default(uuid())
  league_id  String
  league     League    @relation(fields: [league_id], references: [id])
  
  name       String
  
  players    LeaguePlayer[]
  matches    LeagueMatch[]
  
  createdAt  DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}

model LeaguePlayer {
  id          String    @id @default(cuid())
  user_id     String
  user        User      @relation(fields: [user_id], references: [id])
  division_id String
  division    Division  @relation(fields: [division_id], references: [id])
  
  matches     LeagueMatchPlayer[]
  
  createdAt   DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  deleted_at  DateTime?
}

model LeagueMatch {
  id          String    @id @default(cuid())
  division_id String
  division    Division  @relation(fields: [division_id], references: [id])
  
  date        DateTime
  course_id   String
  course      GolfCourse @relation(fields: [course_id], references: [id])
  completed   Boolean   @default(false)
  
  players     LeagueMatchPlayer[]
  
  createdAt   DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  deleted_at  DateTime?
}

model LeagueMatchPlayer {
  id        String    @id @default(cuid())
  match_id  String
  match     LeagueMatch @relation(fields: [match_id], references: [id])
  player_id String
  player    LeaguePlayer @relation(fields: [player_id], references: [id])
  
  score     Int?
  
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}
```

---

## Key Constraints & Indexes

### Unique Constraints
- `User.auth_id` — Firebase UID (no duplicate logins)
- `User.stripe_customer_id` — Stripe customer (no duplicates)
- `Profile.user_id` — One profile per user
- `UserOnboarding.user_id` — One onboarding per user
- `Follow.(follower_id, following_id)` — Prevent duplicate follows
- `FavouriteCourse.(user_id, course_id)` — Prevent duplicate favorites
- `Like.(user_id, post_id)` — Prevent duplicate likes
- `GamePlayer.(user_id, game_id)` — One join per player per game
- `CourseTee.(course_id, tee_name)` — Prevent duplicate tees per course
- `CourseHole.(tee_id, number)` — Prevent duplicate holes per tee
- `PlayerScore.(round_id, user_id)` — One score per player per round
- `ConversationParticipant.(user_id, conversation_id)` — One participant per user per conversation
- `Block.(blocker_id, blocked_id)` — Prevent duplicate blocks
- `StripeAccount.stripe_connect_id` — One Stripe account per user
- `Transaction.(stripe_payment_intent_id, type)` — Prevent duplicate payment records
- `TransactionEventLog.stripe_event_id` — One event log per webhook
- `Notification.id` — Primary key
- `PushToken.token` — Device token uniqueness
- `NotificationSettings.user_id` — One settings per user

### Indexes (Performance)
- `User.last_active_at` — Activity status queries
- `PushToken.user_id` — Push token lookup
- `Notification.(user_id, read)` — Unread notification queries
- `NotificationDelivery.(notification_id, ticket_id, status)` — Delivery tracking
- `Conversation.group_id` — Group conversation lookup
- `Report.(reporter_id, target_user_id, target_conversation_id, target_game_id)` — Report queries
- `Complaint.(game_id, complainant_id)` — Complaint lookup
- `Transaction.user_id, game_id` — Transaction history queries
- `Attribution.user_id` — Attribution lookup
- `LinkClick.(campaign, created_at)` — Campaign analytics

---

## Soft Delete Pattern

All entities include:
```prisma
deleted_at DateTime?
```

**Query Pattern:**
```typescript
// Include active records only
WHERE deleted_at IS NULL

// Soft delete
UPDATE table SET deleted_at = NOW() WHERE id = ?
```

---

## Summary

Alba's database schema defines 32+ entities across 8 domains:
1. **Users & Auth** — User, Profile, Onboarding, Location, Attribution
2. **Games & Players** — Game, GamePlayer, Conversation
3. **Courses & Rounds** — GolfCourse, Round, PlayerScore, Leaderboards
4. **Payments** — StripeAccount, Transaction, TransactionEventLog
5. **Social** — Post, Like, Comment, Follow
6. **Groups & Messages** — Group, Conversation, Message
7. **Notifications** — PushToken, Notification, NotificationDelivery
8. **Moderation** — Block, Report, Complaint

All entities support soft deletes and include timestamps. Critical data is protected by unique constraints and database indexes optimize query performance.
