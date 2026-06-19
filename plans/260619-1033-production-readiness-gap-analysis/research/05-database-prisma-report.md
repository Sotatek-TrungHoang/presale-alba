# Database / Prisma / Data-Integrity Audit — alba-social-backend

Production-readiness audit of the Prisma + PostgreSQL data layer.
Backend root: `alba-social-backend-main`. Schema: `prisma/schema.prisma` (993 lines, 44 models).

---

## Data-Model Overview

Golf social + game-marketplace app. Core entities and relations:

- **User** (uuid) — hub. 1:1 `Profile`, `UserOnboarding`, `StripeAccount`, `UserLocation`, `NotificationSettings`. 1:N everything else.
- **Game** (cuid) — created by a `User` (creator), optional `GolfCourse`/`Group`. Has `GamePlayer[]` (join/payment per player), one `Conversation`, `Transaction[]`, `Complaint[]`. Money fields (`total_cost`, `cost_per_player`) stored as `Int` pence. Payment lifecycle via `PaymentStatus`/`GameStatus` enums.
- **GamePlayer** — join row, `@@unique([user_id, game_id])`. Holds per-player payment state (`has_paid`, `payment_amount`, `stripe_payment_id`, `refunded`).
- **Transaction** / **TransactionEventLog** — Stripe financial ledger, amounts as `Int`, many `@unique` Stripe id columns. Stripe webhook event sourcing.
- **Conversation / ConversationParticipant / Message** — chat, tied to Game or Group.
- **Post / Comment / Like / Image / Round / PlayerScore** — social feed + scorecards (scores as `Json`).
- **GolfCourse / CourseTee / CourseHole / CourseReview / CourseCondition** — course catalog.
- **League / Division / LeaguePlayer / LeagueMatch / LeagueMatchPlayer** — league play.
- Moderation: **Report**, **Block**, **Complaint**. Notifications: **Notification**, **NotificationDelivery**, **PushToken**.
- Marketing: **Attribution**, **LinkClick**.

Almost every model carries `deleted_at DateTime?` (soft delete), but there is **no global Prisma middleware/extension** enforcing the filter (`src/prisma/prisma.service.ts` is a bare `PrismaClient` wrapper) — every read must remember `deleted_at: null` by hand.

Money is correctly stored as `Int` (pence) everywhere — **no Float used for money** (Float only on `lat/lng/handicap/rating/slope`, which is acceptable). Good.

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 5 |
| Medium | 6 |
| Low | 3 |
| **Total findings** | **17** |

Top risks: missing FK indexes at prod scale, soft-deleted message/conversation data leak, non-atomic payment-state writes (race conditions).

---

## Findings

### DB-01 — [Critical] Missing index on `Message.conversation_id` (+ unbounded fetch) → full-table scan on every chat open
- **Evidence:** `prisma/schema.prisma:582-592` (Message model has zero `@@index`); query `src/websockets/chat.service.ts:305` `message.findMany({ where: { conversation_id }, orderBy: { created_at: 'asc' } })`.
- **Impact:** `Message` is the fastest-growing table. With no index on `conversation_id`, Postgres does a sequential scan of the entire messages table every time anyone opens a chat. Combined with no `take:` (loads the *entire* conversation history each fetch), this degrades to O(total_messages) per chat open. At a few hundred thousand messages this is seconds-per-request and will take the app down.
- **Fix:** Add `@@index([conversation_id, created_at])` to `Message`; add cursor pagination (`take`, `cursor`) to `getMessages`.
- **Estimate:** 0.5 man-day.

### DB-02 — [Critical] Soft-deleted messages & conversations leaked to clients
- **Evidence:** `src/websockets/chat.service.ts:305` (`message.findMany` — no `deleted_at: null`); `:251` (`conversation.findMany` — no `deleted_at: null` on conversation, participants, or included messages); `:159`, `:216`, `:323` (`conversation.findFirst/findUnique` — no `deleted_at: null`).
- **Impact:** Any message or conversation that was soft-deleted (moderation removal, user delete, blocked-user cleanup) is still returned to the client. This is a data-integrity + privacy/moderation leak: "deleted" content reappears in the UI. `Message` has a `deleted_at` column that is **never filtered anywhere** in chat reads.
- **Fix:** Add `deleted_at: null` to all chat reads (and to nested `participants`/`messages` includes). Strategic fix: introduce a Prisma client extension that injects `deleted_at: null` by default for soft-deletable models.
- **Estimate:** 1 man-day (point fixes) / 2 man-days (global extension + regression test).

### DB-03 — [Critical] Non-atomic payment-state writes → lost updates / wrong `payment_status` under concurrency
- **Evidence:** `src/games/games.service.ts:1339-1377` — marks `gamePlayer.has_paid=true` (update #1), then *separately* `findUnique` re-reads all players (#2), computes `FULLY_PAID/PARTIALLY_PAID`, then `game.update` (#3) — all outside a transaction. Same read-modify-write-without-tx pattern around payout aggregation at `:1466-1514` and join/approve below.
- **Impact:** Two players paying concurrently: both read the player list before the other's `has_paid` commits, both compute `PARTIALLY_PAID`, and a game that is actually fully paid is left `PARTIALLY_PAID` (or vice-versa). Money state derived from a stale read is a financial-correctness bug. No row locking / no `$transaction` wrapping the read+derive+write.
- **Fix:** Wrap the read-derive-write in `this.prisma.$transaction(async (tx) => {...})`; compute the aggregate inside the tx (and ideally with `SELECT ... FOR UPDATE` semantics via a serializable isolation level or an advisory lock keyed on `game_id`).
- **Estimate:** 1.5 man-days (coordinate with payments audit).

### DB-04 — [High] Non-atomic approve-player flow (`players_current` drift + orphan state)
- **Evidence:** `src/games/games.service.ts:230-272` — separate, un-transacted writes: `gamePlayer.update(APPROVED)` → `game.update({ players_current: { increment: 1 } })` → conditional `game.update(status)` → `conversationParticipant.create`. A failure between steps leaves `players_current` out of sync with actual approved players, or an approved player with no chat seat.
- **Impact:** `players_current` is used to gate `READY_TO_BOOK` and payment math; drift corrupts the game lifecycle. Concurrent approvals also double-increment vs the unique constraint. (Note: the analogous join path at `:507-565` *is* correctly wrapped in `$transaction` — proving the team knows the pattern; this path was missed.)
- **Fix:** Wrap the approve branch in `$transaction`. Consider deriving `players_current` from a `count` of approved players instead of `increment`.
- **Estimate:** 0.5 man-day.

### DB-05 — [High] Pervasive missing foreign-key indexes (write-heavy + filtered FKs)
- **Evidence:** `prisma/schema.prisma`. Only 6 models declare any `@@index`. Missing indexes on heavily-joined/filtered FKs, including:
  - `Game.creator_id` (`:349`), `Game.course_id` (`:360`), `Game.group_id` (`:362`) — filtered in `src/games/*` and `src/admin/games/*`.
  - `Comment.post_id` (`:539`), `Like.post_id` (covered by `@@unique([user_id,post_id])` so OK), `Image.post_id` (`:471`) — feed rendering.
  - `Transaction.user_id` (`:753`), `Transaction.game_id` (`:756`), `Transaction.game_player_id` (`:759`) — Stripe reconciliation/lookups in `src/stripe/stripe.service.ts`.
  - `Post.user_id` (`:454`), `Post.group_id` (`:456`); `CourseReview.course_id`/`user_id` (`:218/220`); `CourseCondition.course_id` (`:231`); `Round.course_id`/`tee_id` (`:482/484`); `Follow.following_id` (only `following_id` side missing — `@@unique([follower_id,following_id])` covers `follower_id` prefix); `GroupMember.user_id`/`group_id` (`:272/274`); `League*` FKs.
- **Impact:** PostgreSQL does **not** auto-create indexes on FK columns. Every join / `where` on these does a sequential scan; deletes/updates of parents also scan children for RI checks. Fine at dev scale, falls over in prod.
- **Fix:** Add `@@index` to each FK actually used in `where`/`orderBy`/joins (see Missing-Index List below). One migration.
- **Estimate:** 1 man-day (add + generate migration + verify with `EXPLAIN`).

### DB-06 — [High] Soft-delete unique constraints block re-creation / are bypassable
- **Evidence:** `@@unique([follower_id, following_id])` (`:146`), `@@unique([user_id, game_id])` GamePlayer (`:425`), `@@unique([user_id, post_id])` Like (`:531`), `@@unique([blocker_id, blocked_id])` Block (`:990`), `@@unique([user_id, conversation_id])` (`:579`).
- **Impact:** These uniques **ignore `deleted_at`**. After a soft-deleted row (e.g. user unfollows = soft delete a Follow, or leaves+rejoins a game = soft-deleted GamePlayer at `:226`), re-creating the same pair throws a unique-constraint violation because the soft-deleted row still occupies the slot. Conversely code paths that "create on re-follow" silently fail. This is an active correctness bug given the code soft-deletes GamePlayer on decline (`games.service.ts:226`).
- **Fix:** Either (a) hard-delete these join rows, or (b) use partial unique indexes `WHERE deleted_at IS NULL` (raw SQL in migration, since Prisma lacks partial-index DSL), and update create logic to `upsert`/reactivate soft-deleted rows.
- **Estimate:** 1.5 man-days.

### DB-07 — [High] No `onDelete` referential actions on the vast majority of relations
- **Evidence:** `prisma/schema.prisma` — only 6 `onDelete` clauses exist (`:712, 860, 876, 901, 903, 920`), all on notification/location models. Game→GamePlayer, Post→Comment/Like/Image, Conversation→Message/Participant, Game→Transaction, etc. have **none** (Prisma default = `Restrict` for required relations / `SetNull` for optional via DB default `NO ACTION`).
- **Impact:** Inconsistent delete semantics. Hard-deleting a parent will throw FK violations (Restrict) for most, but the app relies on soft-delete which **does not cascade** — soft-deleting a Game leaves its GamePlayers/Transactions/Conversation un-soft-deleted, so DB-02-style leaks compound (children of a deleted parent stay visible). No deliberate, documented cascade policy.
- **Fix:** Define an explicit delete policy per relation. For soft-delete, cascade `deleted_at` in service-layer transactions; for any real deletes, set `onDelete: Cascade`/`SetNull` intentionally.
- **Estimate:** 1 man-day (policy + schema annotations).

### DB-08 — [High] Unbounded `findMany` on growing tables (memory blowup)
- **Evidence:**
  - `src/websockets/chat.service.ts:305` — `Message.findMany` no `take` (entire conversation).
  - `src/notifications/notifications.service.ts:309` — `user.findMany({ where: { deleted_at: null }, include: { push_tokens } })` no `take` (loads **all users** + tokens into memory for broadcast).
  - `src/cron/scheduled-notifications.service.ts:145` — `user.findMany` no `take` (all users with location, per cron tick).
- **Impact:** Loads entire tables into Node heap. The notification broadcasts will OOM the process as the user base grows; the cron compounds it on a schedule. On Railway (limited memory) this is a hard crash.
- **Fix:** Batch with `take`/`cursor` and process in chunks; for chat use cursor pagination.
- **Estimate:** 1 man-day.

### DB-09 — [Medium] N+1 query in creator first-payment lookup
- **Evidence:** `src/games/games.service.ts:2059-2070` — `for (const creatorId of creatorIds) { await gamePlayer.findFirst(...) }`, one query per creator.
- **Impact:** Admin/analytics endpoint issues N sequential queries; scales linearly with creator count, slow + DB load.
- **Fix:** Single `groupBy`/raw SQL (`MIN(payment_date) GROUP BY creator_id`).
- **Estimate:** 0.25 man-day.

### DB-10 — [Medium] N+1 in notification-delivery receipt processing & complaint admin fan-out
- **Evidence:** `src/admin/notifications/notifications.service.ts:81-111` — `for (const delivery of ...) { await notificationDelivery.update(...) }`; `src/complaints/complaints.service.ts:116-121` — per-admin `await sendNotificationToUser` in a loop.
- **Impact:** One write/query per delivery/admin; grows with volume. Receipt processing in particular runs over every delivery.
- **Fix:** Batch updates (group by target status into `updateMany`); parallelize/batch admin notifications.
- **Estimate:** 0.5 man-day.

### DB-11 — [Medium] `last_read` / read-tracking & other writes outside transactions (chat)
- **Evidence:** `src/websockets/chat.service.ts` — `createMessage` (`:318+`) creates a Message then bumps conversation/participant state across separate calls; only `:347` uses `$transaction`. Cross-check needed but message-create + conversation `updated_at` bump are split.
- **Impact:** Conversation `updated_at` (used for ordering convos at `:278`) can drift from the actual latest message on partial failure.
- **Fix:** Wrap message create + conversation touch in `$transaction`.
- **Estimate:** 0.5 man-day.

### DB-12 — [Medium] No seed strategy
- **Evidence:** No `prisma/seed.ts`, no `"seed"` key in `package.json` / `prisma` config block.
- **Impact:** Reference data (`CoursePriceThreshold` lookup, enums-as-rows, golf courses) has no reproducible bootstrap. Fresh env / CI / staging provisioning is manual and error-prone; risk of prod being seeded ad-hoc.
- **Fix:** Add `prisma/seed.ts` + `prisma.seed` script for required lookup data.
- **Estimate:** 0.5 man-day.

### DB-13 — [Medium] Nullable fields that are effectively required (silent NULL bugs)
- **Evidence:** `Game.game_format GameFormat?` (`:372`) but `game_type GameType` required — formats inconsistent; `Game.total_cost`/`cost_per_player Int?` (`:374-375`) nullable yet payment math at `games.service.ts:1480` does `player.payment_amount ? game.cost_per_player : 0` assuming non-null; `GamePlayer.payment_amount Int?` used in sums; `User.admin_status Boolean` is **required with no default** (`:19`) — every `user.create` must set it or fail. `User.email String?` nullable (`:20`) despite being a login identity.
- **Impact:** Money sums silently treat NULL cost as 0 → under-charge / wrong payout. Required-no-default booleans cause create failures or accidental admin gaps.
- **Fix:** Make money/cost columns non-null with sensible defaults where the flow guarantees them; add `@default(false)` to `admin_status`; review `email` nullability.
- **Estimate:** 0.75 man-day (needs data backfill review).

### DB-14 — [Medium] Migration drift risk: schema verified against DB not enforced; ad-hoc migration names
- **Evidence:** 48 migrations; several named only `adding`, `removing`, `splitting`, `update` (`20250316121749_adding`, `20250702133445_removing`, `20250512110208_splitting`, `20250615124522_update`) — non-descriptive. Destructive migrations present (`DROP COLUMN/TABLE` in `20260216211355_remove_tee_name`, `20260306000000_replace_address_with_structured_fields`, `20250702133445_removing`, `20250531153558_removing_duplicated_stripe_logic`).
- **Impact:** Non-descriptive names hamper rollback/forensics. Destructive migrations (address restructure, tee_name removal) are data-lossy — confirm they had backfill steps; if not, historical data was dropped. Without `migrate diff` in CI, drift between `schema.prisma` and prod is undetected.
- **Fix:** Add `prisma migrate diff --exit-code` (or `migrate status`) to CI; document the destructive migrations' backfill; adopt descriptive naming going forward.
- **Estimate:** 0.5 man-day.

### DB-15 — [Low] No connection-pool configuration for Railway/serverless
- **Evidence:** `src/prisma/prisma.service.ts` — bare `PrismaClient`, no pool tuning; pool relies entirely on `connection_limit` in `DATABASE_URL` (not visible in repo — `[UNVERIFIED]`, check the deployed env var).
- **Impact:** Default Prisma pool = `num_cpus*2+1` per instance. On Railway with multiple replicas this can exhaust Postgres `max_connections`. No `pgbouncer`/pooler URL config evident.
- **Fix:** Set `connection_limit` + `pool_timeout` in `DATABASE_URL`; if scaling horizontally, front Postgres with a pooler and use the pooled URL. `[UNVERIFIED]` — confirm the prod `DATABASE_URL`.
- **Estimate:** 0.25 man-day.

### DB-16 — [Low] `role` and `platform` stored as free-text String instead of enum
- **Evidence:** `GroupMember.role String @default("MEMBER")` (`:275`, comment says "Could be ADMIN or MEMBER"); `PushToken.platform String` (`:862`, comment "ios or android"); `CourseCondition.condition String` (`:232`).
- **Impact:** No DB-level validation; typos (`"Member"`, `"Android"`) become silent authz/logic bugs vs the enum'd fields elsewhere (the codebase otherwise uses enums consistently).
- **Fix:** Convert to `enum GroupRole`, `enum Platform`.
- **Estimate:** 0.25 man-day.

### DB-17 — [Low] Reports/Complaints reads partially skip `deleted_at` & soft-delete on `Report` underused
- **Evidence:** `src/reports/reports.service.ts` — existence checks at `:24,30,38` `findUnique` without `deleted_at: null` (a soft-deleted target user/game/conversation still counts as valid report target). `complaints.service.ts` 9 finds / 3 `deleted_at`.
- **Impact:** Reports can be filed against soft-deleted entities; minor moderation-data-quality issue.
- **Fix:** Add `deleted_at: null` to target-existence checks.
- **Estimate:** 0.25 man-day.

---

## Missing-Index List (table → column(s) → query that needs it)

| Model | Column(s) to index | Query needing it |
|-------|-------------------|------------------|
| Message | `(conversation_id, created_at)` | `chat.service.ts:305` findMany by conversation, order by created_at |
| Game | `creator_id` | game lists / `games.service.ts` & admin filtered by creator |
| Game | `course_id` | games by course |
| Game | `group_id` | group game feeds |
| Game | `(status, date)` | status/date filtered game discovery |
| GamePlayer | `game_id` (already in unique `[user_id,game_id]` prefix is `user_id` — `game_id` lookups not covered) | `games.service.ts` queries by `game_id` (e.g. player lists) |
| Transaction | `game_id` | `stripe.service.ts` lookups by game |
| Transaction | `user_id` | reconciliation by user |
| Transaction | `game_player_id` | per-player payment lookup |
| Comment | `post_id` | feed comment loading |
| Image | `post_id` | feed image loading |
| Post | `user_id`, `group_id` | profile/group feeds, order by created_at |
| Follow | `following_id` | reverse-follow (followers) lookups (`follower_id` covered by unique prefix) |
| GroupMember | `group_id`, `user_id` | membership lookups |
| CourseReview | `course_id` | course detail reviews |
| CourseCondition | `course_id` | course detail conditions |
| Round | `course_id`, `tee_id` | scorecard joins |
| ConversationParticipant | `conversation_id` | participant lookups (`user_id` covered by unique prefix) |

(Where a column is the *prefix* of an existing `@@unique`, Postgres reuses that index — those are excluded above.)

---

## Task List

1. **[Critical]** Add `@@index([conversation_id, created_at])` to Message + paginate `getMessages` (DB-01).
2. **[Critical]** Add `deleted_at: null` to all chat reads + introduce soft-delete client extension (DB-02).
3. **[Critical]** Wrap payment-status read-derive-write in `$transaction` with locking (DB-03).
4. **[High]** Wrap approve-player flow in `$transaction` (DB-04).
5. **[High]** Add missing FK indexes per table above; one migration + `EXPLAIN` verify (DB-05).
6. **[High]** Convert soft-delete-affected uniques to partial indexes `WHERE deleted_at IS NULL` + reactivate-on-recreate logic (DB-06).
7. **[High]** Define explicit `onDelete` / soft-delete cascade policy (DB-07).
8. **[High]** Add `take`/cursor batching to unbounded `findMany` (notifications, cron, chat) (DB-08).
9. **[Medium]** Fix N+1s: creator first-payment, delivery receipts, complaint fan-out (DB-09, DB-10).
10. **[Medium]** Transaction-wrap chat message create + conversation touch (DB-11).
11. **[Medium]** Add `prisma/seed.ts` + seed script (DB-12).
12. **[Medium]** Tighten nullable money/identity fields + add `admin_status` default (DB-13).
13. **[Medium]** Add `migrate diff/status` to CI; document destructive migrations (DB-14).
14. **[Low]** Pool config for Railway; enum-ize `role`/`platform`; report target soft-delete checks (DB-15, DB-16, DB-17).

---

## Total Estimate

**~13.5 man-days** (point fixes). Global soft-delete extension pushes DB-02 to its 2-day variant → up to **~14.5 man-days**.

Breakdown: Critical 3.0–4.0 d (DB-01 0.5, DB-02 1–2, DB-03 1.5) · High 5.0 d (DB-04 0.5, DB-05 1, DB-06 1.5, DB-07 1, DB-08 1) · Medium 3.0 d · Low 0.75 d.

---

## Open Questions

1. `DATABASE_URL` not in repo — is `connection_limit`/pooler configured in Railway? (DB-15 `[UNVERIFIED]`).
2. Did the destructive migrations (`remove_tee_name`, `replace_address_with_structured_fields`, `removing`) include data backfill, or was data dropped? (DB-14).
3. Is soft-delete intended to be the universal delete strategy? If so, a global Prisma extension + cascade policy should be mandated rather than per-query filters (DB-02, DB-07).
4. Are the join-table uniques (Follow/GamePlayer/Like/Block) meant to allow re-creation after soft-delete, or should those rows be hard-deleted? (DB-06).
