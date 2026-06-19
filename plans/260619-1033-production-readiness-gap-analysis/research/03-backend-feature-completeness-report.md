# Backend Feature Completeness & Code Health Audit — Alba Social Backend

Scope: NON-security, NON-payment, NON-infra. Feature gap vs README vision + code health for production-readiness.
Backend root: `alba-social-backend-main/`. All citations verified against live source.

---

## 1. Summary Table

| Dimension | Result |
|---|---|
| Modules promised in README | 25 |
| Fully implemented (real controller+service+logic) | ~17 (≈68%) |
| Partial (real core, dead/scaffold sub-methods or routing bugs) | ~5 (≈20%) |
| Stub / dead-scaffold modules (NestJS generator placeholders) | 2 fully dead (`messages.service`, `conversations.service`) + 6 modules with live stub routes |
| Live stub routes (route exists, returns `'This action...'` string) | ~10 endpoints |
| Generic `throw new Error(...)` (becomes 500, not proper HTTP) | 15 |
| `console.log/error/warn` in prod paths | 201 |
| Rough overall feature coverage | **~70–75%** of promised capabilities production-real |

**Headline:** Core domain (games, suggestion algorithm, courses, posts, groups, notifications, chat, social, moderation, admin) is genuinely implemented. The gap is a layer of **left-over NestJS scaffold placeholder methods**, several of which are **wired to live routes** (courses CRUD, profiles CRUD, groups delete, leaderboards create/update/remove), plus a **route-ordering bug** in profiles and **missing pagination** on chat history.

---

## 2. Feature Coverage Matrix (README "Project Overview" + "Key Modules")

| Capability | Status | Evidence (file:line) | Gap | Est (md) |
|---|---|---|---|---|
| **Onboarding / golf profiles** | Implemented | `profiles/profiles.service.ts:173+` getUserProfile/updateUserProfile real; `users.controller.ts:142-148` onboarding routes | profiles.service.create/findAll/findOne/remove are stubs (see below) | 0 |
| **Profiles CRUD (generic)** | **Stub (live)** | `profiles.service.ts:165` findAll, `:169` findOne, `:466` remove return `'This action...'`; routed at `profiles.controller.ts:23,28,33,62` | create/findAll/findOne/remove non-functional but exposed | 1.5 |
| **Profiles route ordering bug** | Bug | `profiles.controller.ts:32` `@Get(':id')` declared BEFORE `:40` `@Get('user-profile')` & `:49 'onboarding-status'` | `/profiles/user-profile` matches `:id` route first → wrong handler | 0.25 |
| **Post games (rounds)** | Implemented | `games.controller.ts:34` createGame → `games.service.ts` createGame (2200 LOC service) | — | 0 |
| **Recommend games (suggestion algorithm)** | Implemented | `games.controller.ts:67` getSuggestedGames; full weighted-scoring strategy in `games/suggestion.strategy.ts:75-193` (distance/gameType/handicap/social/urgency) | Real, sophisticated, complete | 0 |
| **Nearby games** | Implemented | `games.controller.ts:44` getNearbyGames | — | 0 |
| **Join games / player approval workflow** | Implemented | `games.controller.ts:39` joinGame, `:135` updatePlayerStatus, `:151` respondToInvitation, `:167` confirm, `:182` complete | — | 0 |
| **Game update** | Implemented | `games.controller.ts:125` updateGame → real | `games.service.ts:1304` update() stub exists but NOT routed (dead) | 0 |
| **Game delete** | Missing | no `@Delete` in `games.controller.ts`; `games.service.ts:1308` remove() is dead stub | No API to delete/cancel-by-delete a game | 0.5 |
| **Courses: data / search / by-location** | Implemented | `courses.controller.ts:79` search, `:104` search-with-location, `:113` by-location, `:75` findAll (cached) | — | 0 |
| **Courses: reviews** | Implemented | `courses.controller.ts:45` addReview → real | — | 0 |
| **Courses: condition reports** | Implemented | `courses.controller.ts:51` addConditionReport → real | — | 0 |
| **Courses: tees / holes** | Implemented | `courses.controller.ts:130` findTees; tee/hole aggregation `courses.service.ts:96-127` | — | 0 |
| **Courses CRUD (create/update/delete)** | **Stub (live)** | `courses.service.ts:180` create, `:891` update, `:895` remove return `'This action...'`; routed `courses.controller.ts:40,136,141` | Admin course CRUD goes through `admin/courses` (real); these public-ish stubs are misleading & broken (`+id` on cuid → NaN) | 1.5 |
| **Posts: general + SCORE posts** | Implemented | `posts.service.ts:18-61` SCORE path creates round+player scores | — | 0 |
| **Posts: likes / comments** | Implemented | `posts.controller.ts:33` like, `:39` comment, `:50` unlike | — | 0 |
| **Posts: edit / delete** | Missing (route) | `posts.service.ts:291` update, `:295` remove stubs; NOT routed in `posts.controller.ts` | No edit/delete post API | 0.5 |
| **Posts: feed pagination** | Implemented | `posts.service.ts:108-130` cursor pagination | — | 0 |
| **Groups: create/join/leave/search/get** | Implemented | `groups.controller.ts:26-55` all real | — | 0 |
| **Groups: update** | Implemented | `groups.controller.ts:58` → updateGroup real | — | 0 |
| **Groups: delete** | **Stub (live)** | `groups.controller.ts:63` `@Delete(':id')` → `remove(+id)`; `groups.service.ts:366` returns `'This action...'` | Delete group non-functional but exposed; `+id` on cuid → NaN | 0.5 |
| **Conversations** | Implemented (via ChatService) | `conversations.controller.ts:21-47` all delegate to `websockets/chat.service.ts` (real) | `conversations/conversations.service.ts` (26 LOC, all stubs) is **dead/unused** | 0.25 (delete) |
| **Messages** | Implemented (via ChatService) | `messages.controller.ts:13` create → chat.service.createMessage (real, with block-check `chat.service.ts:316+`) | `messages/messages.service.ts` (26 LOC, all stubs) is **dead/unused** | 0.25 (delete) |
| **Messages: history pagination** | **Partial / scale risk** | `chat.service.ts:304` getMessages does `findMany` with NO take/skip/cursor — loads entire conversation | Unbounded query; will degrade on long chats | 0.5 |
| **Real-time chat (Socket.IO)** | Implemented | `websockets/chat.gateway.ts` (204 LOC), `chat.service.ts` (582 LOC) | — | 0 |
| **Notifications: push/history/prefs/settings** | Implemented | `notifications.controller.ts:31-129` register/list/read/read-all/delete/send/settings; `push-notification.service.ts` (Expo) | — | 0 |
| **Leaderboards: query** | Implemented | `leaderboards.service.ts:20-63` findLeaderboard real (PlayerScore aggregation) | — | 0 |
| **Leaderboards: create/update/remove/findAll** | **Stub (live, no auth)** | `leaderboards.service.ts:13,16,65,69` return `'This action...'`; routed `leaderboards.controller.ts:21,35,40` with **no FirebaseAuthGuard** | create/update/remove non-functional + unauthenticated routes (also a security note) | 0.75 |
| **Relationships (follow/unfollow/status)** | Implemented | `relationships.controller.ts:22,31,40` all real | — | 0 |
| **Complaints (game complaints)** | Implemented | `complaints.controller.ts:20,34,40` create/get/resolve real | — | 0 |
| **Reports (content reporting)** | Implemented | `reports.controller.ts:22,28,34` create/list/resolve real | — | 0 |
| **Blocks (user blocking)** | Implemented | `blocks.controller.ts:20,26,32` block/unblock/list; enforced in chat `chat.service.ts:328+` | — | 0 |
| **Locations** | Implemented | `locations/locations.service.ts`; Google Maps `shared/services/google-maps.service.ts`, Mapbox `mapbox.service.ts` | — | 0 |
| **Images / image-processing** | Implemented | `images/images.service.ts`, `image-processing/image-processing.service.ts` (S3 + processing) | — | 0 |
| **Admin (users/games/courses/dashboards/notifications/analytics)** | Implemented | controllers under `admin/*` — 23 routes total; `admin/games/games.service.ts` (786 LOC), `admin/game-analytics` (417 LOC) | — | 0 |
| **Attribution** | Implemented | `attribution.controller.ts:11` create real; `go.controller.ts` redirect | — | 0 |
| **Round (deep-link landing)** | Implemented (intentional) | `round/round.controller.ts:10` HTML landing for app deep links | Not a CRUD module — by design | 0 |
| **v1/games** | Implemented | `v1/games/games.controller.ts:27-73` getAll/create/pay/update/confirm/virtual-card real | Parallel v1 API surface (duplication risk — see health) | 0 |
| **well-known** | Implemented | `well-known/well-known.controller.ts` (.well-known assetlinks/apple-app-site-association) | — | 0 |

---

## 3. Incomplete-Work Markers (file:line)

Left-over NestJS generator placeholder methods returning literal `'This action ...'` strings:

| File:line | Method | Routed (LIVE)? |
|---|---|---|
| `messages/messages.service.ts:8,12,16,20,24` | create/findAll/findOne/update/remove | NO — whole file dead (controller uses ChatService) |
| `conversations/conversations.service.ts:8,12,16,20,24` | create/findAll/findOne/update/remove | NO — whole file dead |
| `courses/courses.service.ts:180` | create | **YES** `courses.controller.ts:40` |
| `courses/courses.service.ts:891,895` | update/remove | **YES** `courses.controller.ts:136,141` |
| `profiles/profiles.service.ts:165,169` | findAll/findOne | **YES** `profiles.controller.ts:28,33` |
| `profiles/profiles.service.ts:466` | remove | **YES** `profiles.controller.ts:62` |
| `profiles` create | create | **YES** `profiles.controller.ts:23` (verify body) |
| `leaderboards/leaderboards.service.ts:13,16,65,69` | create/findAll/update/remove | **YES (no auth)** `leaderboards.controller.ts:21,35,40` |
| `groups/groups.service.ts:362,366` | update*/remove | remove **YES** `groups.controller.ts:64`; update NOT (real updateGroup used) |
| `posts/posts.service.ts:291,295` | update/remove | NO — not routed |
| `users/users.service.ts:999,1003` | update/remove (legacy) | NOT these specific stubs (controller uses real handlers) — dead |
| `games/games.service.ts:1304,1308` | update/remove stubs | NO — real updateGame routed; these dead |

No `TODO`/`FIXME`/`HACK`/`XXX`/`not implemented`/`coming soon` comments found in `src/` (grep clean). No hardcoded mock data found in prod query paths.

---

## 4. Code-Health Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| H1 | **God service: stripe** 3169 LOC | `stripe/stripe.service.ts` (out of audit scope but flag) | (payment scope) |
| H2 | **God service: games** 2200 LOC, single class | `games/games.service.ts` | High |
| H3 | **Large service: notifications** 1504 LOC | `notifications/notifications.service.ts` | Medium |
| H4 | **Large service: users** 1370 LOC | `users/users.service.ts` | Medium |
| H5 | **Large service: courses** 903 LOC | `courses/courses.service.ts` | Medium |
| H6 | Files exceed CLAUDE.md 200-LOC guideline broadly | wc -l: 14+ files >300 LOC | Low |
| H7 | **Inconsistent error handling**: 15 generic `throw new Error()` → surface as 500 instead of 4xx | `users.service.ts:409,425,782` ('User not found' should be NotFoundException), `groups.service.ts:175`, `chat.service.ts:151` | Medium |
| H8 | **201 `console.log/error/warn` in prod paths** instead of Nest Logger | grep across `src` (e.g. `courses.service.ts:190-194`, `chat.service.ts:318`) | Medium |
| H9 | **Missing pagination on chat history** — `getMessages` unbounded `findMany` | `chat.service.ts:304-316` | High |
| H10 | **Missing/uncertain pagination** on `getConversations`, leaderboard `findLeaderboard`, relationships followers/following, notifications GET — verify per-endpoint | `chat.service.ts:250`, `leaderboards.service.ts:31` (no take) | Medium |
| H11 | **Type-coercion bug pattern**: `+id` / `remove(+id)` on cuid string IDs yields `NaN` | `courses.controller.ts:137,142`, `groups.controller.ts:65`, `profiles.controller.ts:34,63` | Medium |
| H12 | **API duplication**: `games/` and `v1/games/` two parallel game APIs (createGame, updateGame, payment) — divergence/maintenance risk | `games.controller.ts` vs `v1/games/games.controller.ts` | Medium |
| H13 | **Dead module files** registered but unused (ChatService supersedes) | `messages/messages.service.ts`, `conversations/conversations.service.ts` | Low |
| H14 | **Inconsistent response shapes**: some endpoints return raw Prisma objects, some return mapped DTOs (e.g. leaderboard entries DTO vs games raw) | `leaderboards.service.ts:48` vs `games.service.findOne` | Low |
| H15 | soft-delete (`deleted_at`) applied broadly & consistently (positive) | 22 services filter `deleted_at` | (good) |

---

## 5. Task List (prioritized)

| ID | Task | Severity | Est (md) |
|---|---|---|---|
| T1 | Replace/implement or remove live course CRUD stubs (`courses.service.ts:180/891/895`) — decide public vs admin-only; fix NaN id | High | 1.5 |
| T2 | Implement or remove profiles create/findAll/findOne/remove stubs + fix `:id` route-ordering bug | High | 1.75 |
| T3 | Fix/implement or remove leaderboards create/update/remove stubs **and add auth guards** | High | 0.75 |
| T4 | Implement or remove groups `Delete :id` stub; fix NaN id coercion | Medium | 0.5 |
| T5 | Add pagination to chat `getMessages` (and audit getConversations / followers / notifications / leaderboard) | High | 1.0 |
| T6 | Add post edit/delete + game delete/cancel endpoints if product requires (confirm with PM) | Medium | 1.0 |
| T7 | Standardize error handling: convert 15 generic `throw new Error` to proper Nest HTTP exceptions | Medium | 0.75 |
| T8 | Replace 201 console.* with Nest Logger; gate verbose logs by env | Medium | 1.0 |
| T9 | Delete dead scaffold files `messages.service.ts`, `conversations.service.ts` (and unwire from modules) | Low | 0.25 |
| T10 | Refactor god services (games 2200, notifications 1504, users 1370, courses 903) into focused sub-services | High | 5.0 |
| T11 | Reconcile `games` vs `v1/games` duplication (deprecate one / share service) | Medium | 1.5 |
| T12 | Standardize response shapes (DTO mappers) across list/detail endpoints | Low | 1.5 |

**Total estimate: ~17 man-days** (T1–T9 quick wins ≈ 7.5 md; refactors T10–T12 ≈ 8 md; rounding/buffer).

---

## 6. Open Questions

1. Are public `courses` CRUD and `profiles` CRUD endpoints intended at all, or were they scaffold leftovers (real admin CRUD lives in `admin/*`)? Affects T1/T2: implement vs delete.
2. Is `leaderboards` create/update/remove a planned feature, or read-only-by-design? Auth-less write routes are also a security flag (cross-ref security report).
3. Should `posts` and `games` support edit/delete via API, or is deletion admin-only / soft-cancel via status? (T6 scope)
4. Is `v1/games` the migration target or legacy? (T11 direction)
5. `[UNVERIFIED]` exact pagination state of `relationships` followers/following and `notifications` GET list — flagged for per-endpoint check; not individually opened in this pass.
