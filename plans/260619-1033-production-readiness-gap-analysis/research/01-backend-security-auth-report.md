# Backend Security & Auth/Authz — Production-Readiness Deep Audit

**Target:** `alba-social-backend-main` (NestJS)
**Date:** 2026-06-19
**Auditor dimension:** Per-endpoint authz, auth-flow correctness, input validation, infra hardening, injection/upload/SSRF.
**Builds on:** `plans/reports/security-scan-2026-06-19.md` (reconciled below — net-new findings flagged).

Every finding cites a `file:line` actually opened. Items I could not confirm at runtime are marked **[needs runtime confirmation]**.

---

## Summary (counts by severity)

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High     | 6 |
| Medium   | 7 |
| Low      | 4 |
| **Total**| **21** |

Headline: the codebase relies almost entirely on `@UseGuards(FirebaseAuthGuard)` for *authentication* but has **very thin authorization** — multiple endpoints take the target resource owner (`userId`, `conversationId`) straight from the URL/body with no ownership check, and several "admin" actions have **no guard at all**. This is a broader and more severe picture than the earlier scan, which focused on secrets/deps/XSS and flagged only `/leaderboards` for access control.

---

## Findings

### SEC-01 — [Critical] IDOR: read ANY user's conversation messages
- **Evidence:** `src/conversations/conversations.controller.ts:43-47` (`GET /conversations/:conversationId/messages`) → `src/websockets/chat.service.ts:304-316` `getMessages(conversationId)` filters only `where: { conversation_id }` — **no participant check**.
- **Impact:** Any authenticated user can read the full private message history of any conversation by guessing/enumerating IDs (cuid). Mass private-data breach.
- **Fix:** In `getMessages`, resolve `req.user.uid` → user.id and require the user be a participant of the conversation before returning. Pass `req.user.uid` from controller (currently not passed at all).
- **Estimate:** 0.5

### SEC-02 — [Critical] IDOR: list ANY user's conversations
- **Evidence:** `src/conversations/conversations.controller.ts:37-41` (`GET /conversations/:userId`) passes the **URL `:userId`** (not `req.user`) into `chat.service.ts:250-256` `getConversations(userId)`.
- **Impact:** Any authenticated user enumerates another user's conversation list + participant profiles. Social-graph / PII leak.
- **Fix:** Ignore the `:userId` param; derive the caller's id from `req.user.uid`. (Param should be removed entirely.)
- **Estimate:** 0.25

### SEC-03 — [Critical] WebSocket: join ANY conversation room → read/inject messages
- **Evidence:** `src/websockets/chat.gateway.ts:87-108` `joinRoom` calls `client.join(roomId)` with **no check that the socket's user is a participant** of `roomId`. `sendMessage` (`:147-203`) and `newMessage` broadcast only gate on "is in room" (`:162-167`), so once joined, the attacker receives all live messages and can post into the conversation.
- **Impact:** Real-time eavesdropping + message injection into arbitrary conversations. Same trust gap as SEC-01 over the socket channel.
- **Fix:** In `handleJoinRoom`, verify `client.userId` is a participant of the conversation (DB check) before `client.join`. Reject otherwise.
- **Estimate:** 0.5

### SEC-04 — [Critical] Unauthenticated mass-notification / spam + unauth user mutation
- **Evidence:**
  - `src/notifications/notifications.controller.ts:92-115` — `POST /notifications/send/:userId` and `POST /notifications/send-all` are commented "admin function" but have **only the class-level `FirebaseAuthGuard`**, no `AdminGuard`. Any logged-in user can push a notification to any user or **all users**.
  - `src/users/users.controller.ts:35-37` `POST /users`, `:49-52` `GET /users` (`findAll` — lists every user), `:186-189` `PATCH /users/:id`, `:191-194` `DELETE /users/:id`, `:164-172` `GET /users/test-onboarding/:authId` — **no guard at all**.
- **Impact:** Unauthenticated full user enumeration; unauthenticated arbitrary user create/update/delete (mass account takeover/destruction); authenticated push-spam to entire userbase (abuse, phishing vector).
- **Fix:** Add `@UseGuards(FirebaseAuthGuard, AdminGuard)` to `send/:userId`, `send-all`, and `PATCH/DELETE /users/:id`; remove or guard `GET /users` and `test-onboarding`; restrict/remove public `POST /users` (signup goes through `/auth/signup` + onboarding).
- **Estimate:** 1

### SEC-05 — [High] `GET /complaints/games/:gameId` exposes all complaints to any auth user
- **Evidence:** `src/complaints/complaints.controller.ts:34-38` → `src/complaints/complaints.service.ts:130-145` `getGameComplaints` does **no admin or game-participant check** (resolve at `:150-161` *does* check admin; the GET does not).
- **Impact:** Any authenticated user reads complainant names/profiles + complaint text for any game. PII + moderation-data leak.
- **Fix:** Gate behind `AdminGuard` (or verify caller is game participant/the complainant).
- **Estimate:** 0.25

### SEC-06 — [High] No rate limiting anywhere (throttler absent)
- **Evidence:** `grep throttler|helmet package.json` → **NONE FOUND**; no `ThrottlerModule`/`@Throttle` in `src/**`. Confirms earlier finding #5 and extends it: brute-force of auth-adjacent flows, the IDOR enumeration above, and Stripe payment endpoints are all unthrottled.
- **Impact:** Enables practical exploitation of SEC-01/02 (ID enumeration), payment abuse, and notification spam (SEC-04).
- **Fix:** Add `@nestjs/throttler` global guard; tighter limits on auth, stripe, notifications.
- **Estimate:** 0.5

### SEC-07 — [High] Inline admin checks instead of guard (fragile, easy to miss)
- **Evidence:** Admin authorization is enforced ad-hoc inside handlers rather than via `AdminGuard`:
  - `src/games/games.controller.ts:104-117` payout-review, `:208-217` `POST /:id/payout` — manual `if (!user.admin_status)`.
  - This pattern is correct *here* but is the same pattern that was forgotten in SEC-04/SEC-05. It is a structural risk: admin enforcement is inconsistent across the codebase.
- **Impact:** Inconsistent enforcement → the omissions in SEC-04/05 are the realized form of this risk. High likelihood of recurrence as routes are added.
- **Fix:** Standardize on `@UseGuards(FirebaseAuthGuard, AdminGuard)` for all admin actions; remove inline `admin_status` checks. Audit every `admin_status` reference.
- **Estimate:** 0.5

### SEC-08 — [High] Unrestricted file content-type on S3 presign (stored-XSS vector)
- **Evidence:** `src/images/images.service.ts:25-51` — `fileType` comes from the request body (`GetPresignedUrlDto`) and is fed directly into `['starts-with', '$Content-Type', fileType]` with **no whitelist**. Key prefix is `profileImage/` and server-generated (no path traversal — good), but a user can upload `text/html` / `image/svg+xml`.
- **Impact:** If these objects are ever served from a same-site/app origin with that content-type (profile images are), stored XSS / SVG script execution.
- **Fix:** Whitelist `fileType` to `image/jpeg|png|webp`; set `Content-Disposition`/`X-Content-Type-Options` on serving; validate DTO with `@IsIn([...])`.
- **Estimate:** 0.5 **[needs runtime confirmation of how images are served]**

### SEC-09 — [High] Reflected XSS in `/go` (confirmed, carried from earlier scan)
- **Evidence:** `src/attribution/go.controller.ts:24-94` — `GET /go` unauthenticated, reflects `req.originalUrl`-derived `webUrl`/`deepLink` into HTML attributes without escaping (earlier scan finding #1).
- **Impact:** Arbitrary JS in `app.golfalba.co` origin, public.
- **Fix:** HTML-entity-encode reflected values; whitelist query keys; add CSP on this response.
- **Estimate:** 0.5

### SEC-10 — [High] Vulnerable dependency backlog (carried; auth-adjacent)
- **Evidence:** Earlier scan: backend `npm audit` = 63 vulns (3 critical, 14 high) incl. `jws` (HMAC verification), `express` redirect XSS, `multer`/`body-parser` DoS. Not re-run here; cited from prior report.
- **Impact:** `jws`/auth-adjacent + DoS on upload paths.
- **Fix:** `npm audit fix`; bump pinned majors; re-audit `--omit=dev`.
- **Estimate:** 1

### SEC-11 — [Medium] CORS fully open
- **Evidence:** `src/main.ts:42` `app.enableCors()` with no options → reflects any origin.
- **Impact:** Becomes serious if cookie/credential auth is ever added; today tokens are Bearer-header so impact is lower, but still permits any site to call the API from the browser.
- **Fix:** Restrict `origin` to app/web domains; set `credentials` explicitly.
- **Estimate:** 0.25

### SEC-12 — [Medium] Swagger exposed in all environments
- **Evidence:** `src/main.ts:35-41` — `SwaggerModule.setup('api', ...)` unconditional, no `NODE_ENV` gate.
- **Impact:** Full API surface disclosure in production — directly aids attackers in finding the IDOR/unauth routes above.
- **Fix:** Gate behind `NODE_ENV !== 'production'` or auth.
- **Estimate:** 0.25

### SEC-13 — [Medium] No `helmet` / security headers
- **Evidence:** `package.json` has no `helmet`; `main.ts` adds no header middleware.
- **Impact:** Missing HSTS, X-Content-Type-Options (compounds SEC-08), X-Frame-Options, etc.
- **Fix:** `app.use(helmet())` in `main.ts`.
- **Estimate:** 0.25

### SEC-14 — [Medium] ValidationPipe missing `whitelist`/`forbidNonWhitelisted`
- **Evidence:** `src/main.ts:28-33` — only `transform: true` + `enableImplicitConversion`. **Net-new concern beyond earlier scan #8:** `enableImplicitConversion` with no whitelist means unexpected/extra body fields pass through untouched. Combined with services that do accept some raw bodies, this is mass-assignment exposure for any future `data: { ...dto }` Prisma write.
- **Impact:** Mass assignment / over-posting if any service spreads a DTO into a write.
- **Fix:** Add `whitelist: true, forbidNonWhitelisted: true`.
- **Estimate:** 0.25 (plus regression testing)

### SEC-15 — [Medium] `createConversation` accepts arbitrary participant IDs
- **Evidence:** `src/conversations/conversations.controller.ts:19-23` → `chat.service.ts:87-101` `createConversation` takes `participantIds` from body with **no check that the caller is among them**.
- **Impact:** A user can create conversations between other users / inject themselves out, and seed unwanted threads. Lower severity than SEC-01 but same trust pattern.
- **Fix:** Force-include `req.user`'s id; validate caller is a participant.
- **Estimate:** 0.25

### SEC-16 — [Medium] Many public read endpoints expose user/course data with no auth
- **Evidence:** `src/users/users.controller.ts:90-139` — `:id/groups`, `:id/leagues`, `:id/favourite-courses`, `:id/followers`, `:id/following`, `:id/games`, `:id/feed` all **no guard**. `src/courses/courses.controller.ts:39-141` — `POST /courses` (no-op stub), `GET`, `GET :id`, `PATCH :id`, `DELETE :id` mostly unguarded (`update`/`remove` likely stubs — verify). `src/leaderboards/leaderboards.controller.ts:20-39` — unauth PII (earlier scan #3) + dead CRUD stubs.
- **Impact:** Unauthenticated harvesting of social graph, user feeds, favourite courses. Some (`PATCH/DELETE` course) may be live writes — **[needs confirmation whether course update/remove are stubs]**.
- **Fix:** Add `FirebaseAuthGuard` to user-data reads; guard or remove course/leaderboard write stubs.
- **Estimate:** 0.5

### SEC-17 — [Medium] No env-var validation schema
- **Evidence:** `src/app.module.ts:45-46` `ConfigModule.forRoot({ isGlobal: true })` — no `validationSchema`. Missing critical secrets (Stripe, Firebase, AWS, Sentry) fail late/at-request-time instead of at boot.
- **Impact:** Silent misconfiguration in production (e.g., webhook secret unset → either crash or, worse, skipped verification depending on code path).
- **Fix:** Add Joi `validationSchema` requiring all runtime secrets.
- **Estimate:** 0.25

### SEC-18 — [Low] Background `last_active_at` update is fire-and-forget unawaited
- **Evidence:** `src/guards/firebase-auth.guard.ts:36,44-58` — `bumpLastActiveAt` is not awaited; errors only `console.error`. Not a vuln, but an unbounded DB write per request with no backpressure (minor DoS amplifier under the unthrottled API, SEC-06).
- **Impact:** Low — operational.
- **Fix:** Acceptable as-is; consider a queue. Lower priority.
- **Estimate:** 0.25

### SEC-19 — [Low] Verbose error/stack logging in webhooks
- **Evidence:** `src/stripe/stripe-webhook.controller.ts` (logs stacks + event data — earlier scan #12) and `src/main.ts:13-17` global `warning` handler logs stacks.
- **Impact:** Sensitive data in logs if logs are externally accessible.
- **Fix:** Redact; ensure log sink is private.
- **Estimate:** 0.25

### SEC-20 — [Low] Dead/unauth scaffold endpoints (footguns)
- **Evidence:** `src/leaderboards/leaderboards.controller.ts:20,30,38` POST/PATCH/DELETE stubs; `src/courses/courses.service.ts:179-181` `create` returns a string stub while controller exposes `POST /courses`. `src/users/users.controller.ts:164-172` `test-onboarding/:authId` e2e endpoint shipped.
- **Impact:** Future activation without guards; test endpoint leaks onboarding data by authId today.
- **Fix:** Remove dead CRUD + test endpoint before go-live.
- **Estimate:** 0.25

### SEC-21 — [Low] FirebaseAuthGuard logs raw token-verification errors
- **Evidence:** `src/guards/firebase-auth.guard.ts:39` `console.error('Token verification failed:', error)` — full error object. Auth flow otherwise correct: missing token → 401 (`:23-25`), invalid/expired → 401 (`:38-41`), `request.user` populated with uid/email/emailVerified. **AdminGuard ordering verified safe:** `AdminGuard` reads `request.user` (`admin.guard.ts:19-23`) which only exists after `FirebaseAuthGuard`; every admin controller lists them in correct order `(FirebaseAuthGuard, AdminGuard)` — fails closed if user absent.
- **Impact:** Minor log verbosity / possible token fragment in logs.
- **Fix:** Log `error.code`/message only.
- **Estimate:** 0.25

---

## Authorization Matrix (high-signal routes)

| Route | Guard | Ownership / authz check | Risk |
|-------|-------|-------------------------|------|
| `GET /conversations/:conversationId/messages` | FirebaseAuth | **NONE** (any conv) | **Critical (SEC-01)** |
| `GET /conversations/:userId` | FirebaseAuth | **NONE** (param-driven) | **Critical (SEC-02)** |
| WS `joinRoom` | socket auth | **NONE** (any room) | **Critical (SEC-03)** |
| `POST /notifications/send/:userId` | FirebaseAuth only | **NO admin** | **Critical (SEC-04)** |
| `POST /notifications/send-all` | FirebaseAuth only | **NO admin** | **Critical (SEC-04)** |
| `GET /users` (findAll) | **NONE** | none | **Critical (SEC-04)** |
| `POST /users`, `PATCH/DELETE /users/:id` | **NONE** | none | **Critical (SEC-04)** |
| `GET /users/test-onboarding/:authId` | **NONE** | none | High (SEC-20) |
| `GET /complaints/games/:gameId` | FirebaseAuth | **NO admin/participant** | High (SEC-05) |
| `POST /images` (presign) | FirebaseAuth | own key (server-gen) ✓, **no content-type whitelist** | High (SEC-08) |
| `GET /users/:id/{feed,followers,games,...}` | **NONE** | none | Medium (SEC-16) |
| `GET /go` | none (public by design) | reflects input (XSS) | High (SEC-09) |
| `POST /conversations` | FirebaseAuth | **caller not forced participant** | Medium (SEC-15) |
| `POST /games/:id/payout` | FirebaseAuth + inline admin | inline `admin_status` ✓ | OK (fragile, SEC-07) |
| `PATCH /groups/:id` | FirebaseAuth | group-ADMIN check ✓ | OK |
| `POST /games/:id/players/:playerId/payment` | FirebaseAuth | `user.id===playerId` ✓ | OK |
| `relationships/follow`,`unfollow` | FirebaseAuth | uses `req.user.uid` ✓ | OK |
| `users/me`, `users/home-feed`, `posts/*`, `reports/*` | FirebaseAuth | uses `req.user.uid` ✓ | OK |
| admin/* controllers | FirebaseAuth + AdminGuard | guard order verified ✓ | OK |
| `POST /stripe/webhook/*` | none (sig verify) | signature verified ✓ | OK |

---

## Prioritized task list

1. **SEC-04** add guards to unauth user-mutation + notification-broadcast routes (1d)
2. **SEC-01 / SEC-02 / SEC-03** ownership checks on conversation read + WS joinRoom (1.25d)
3. **SEC-05** admin-gate game complaints read (0.25d)
4. **SEC-07** standardize admin enforcement on AdminGuard, audit all `admin_status` refs (0.5d)
5. **SEC-06** add throttler (0.5d)
6. **SEC-08** content-type whitelist on presign + serving headers (0.5d)
7. **SEC-09** fix `/go` reflected XSS (0.5d)
8. **SEC-16** guard public user-data reads; remove dead/test endpoints SEC-20 (0.75d)
9. **SEC-11/12/13** CORS lockdown, Swagger gate, helmet (0.75d)
10. **SEC-14/17/15** ValidationPipe whitelist, env schema, conversation participant force (0.75d)
11. **SEC-10** dependency remediation (1d)
12. **SEC-18/19/21** logging/operational hardening (0.5d)

**Total estimate: ~9.0 man-days** (Critical/High cluster ≈ 5.25d).

---

## Net-new vs earlier scan

- **Net-new (not in earlier scan):** SEC-01, SEC-02, SEC-03 (conversation/WS IDOR), SEC-04 (unauth user CRUD + notification broadcast), SEC-05 (complaints read), SEC-07 (inline-admin fragility), SEC-08 (presign content-type), SEC-15 (conversation participants), SEC-16 (public user-data reads), SEC-17 (env validation), SEC-21 (guard-order verification — confirmed safe).
- **Reconciled / confirmed from earlier scan:** SEC-09 (=#1 XSS), SEC-10 (=#2 deps), SEC-06 (=#5 throttler), SEC-11 (=#4 CORS), SEC-12 (=#6 Swagger), SEC-13 (=#10 helmet), SEC-14 (=#8 ValidationPipe — escalated to Medium with rationale), SEC-19 (=#12 logging), SEC-20 (=#9 dead endpoints). Earlier scan #3 (/leaderboards PII) folded into SEC-16.

---

## Open questions

1. Are `courses` `PATCH :id` / `DELETE :id` live writes or stubs? (`create` is a string stub; need to read `update`/`remove` in `courses.service.ts`.)
2. How/where are S3 profile images served (same origin? inline?) — determines SEC-08 exploitability.
3. Is `GET /users` (findAll) used by any legit client, or pure dead code? Determines remove-vs-guard.
4. Is the Stripe webhook secret guaranteed present at boot (relates to SEC-17)? Verify `constructWebhookEvent` does not silently skip verification if env unset.
5. Are conversation IDs cuid/uuid (enumeration cost) — affects practical exploit speed of SEC-01.
