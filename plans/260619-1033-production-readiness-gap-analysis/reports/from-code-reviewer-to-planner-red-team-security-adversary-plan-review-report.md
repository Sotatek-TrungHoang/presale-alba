# Red-Team Plan Review — Security Adversary + Fact Checker

**Reviewer role:** Hostile Security Adversary / Fact Checker
**Plan reviewed:** `plans/260619-1033-production-readiness-gap-analysis` (plan.md + phase-01..07 + research/01,02)
**Codebase verified:** `alba-social-backend-main`, `alba-golf-rn-main`
**Date:** 2026-06-19

Verdict: the plan's headline Critical findings are **factually accurate** (SEC-01/02/03/04, PAY-01/02, INF-03, DB-03 all confirmed at the cited lines). But the plan contains **attacker-exploitable gaps in the fixes themselves**, two missed attack surfaces, one fix-ordering window that leaves money loss live through all of Phase 1, and one fix instruction that would break production signup. 9 findings below.

---

## Finding 1
**Severity:** Critical
**Location:** Phase 1 → SEC-03 fix ("verify `client.userId` is a participant before join"); `research/01` SEC-03.
**Flaw:** The plan's SEC-03 fix assumes the socket is authenticated and only adds a *participant* check. But `handleJoinRoom` does **not require `client.userId` at all** — `joinRoom` only checks `this.rooms.get(client.id)` exists, then calls `client.join(roomId)` unconditionally. The participant guard `if (client.userId)` at line 104 is purely for activity-tracking and is *skipped* when userId is absent. An **unauthenticated** socket (never sent `authenticate`) can join any room and receive all live messages. The fix as written ("verify participant") still leaves a hole if the developer derives membership from a possibly-undefined `client.userId` (treats `undefined` as "not blocked").
**Failure scenario:** Attacker opens a websocket, skips `authenticate`, emits `joinRoom {roomId: <victim conv id>}` → joins, receives every live message broadcast to that room. `sendMessage` is gated on `client.userId` (line 156) so injection needs auth, but eavesdropping does not.
**Evidence:** `src/websockets/chat.gateway.ts:87-110` — `handleJoinRoom` has no `client.userId` presence check before `await client.join(roomId)` (line 100); `if (client.userId)` only at line 104. WS CORS `origin: '*'` at `chat.gateway.ts:21-22`.
**Suggested fix:** In Phase 1 SEC-03, FIRST reject if `!client.userId` (force `authenticate` before any `joinRoom`), THEN do the DB participant check. Add explicit success-criterion: "unauthenticated socket cannot join any room."

## Finding 2
**Severity:** Critical
**Location:** Phase 1 → SEC-04 fix instruction: "restrict/remove public `POST /users` (signup goes through `/auth/signup` + onboarding)"; `research/01` SEC-04 fix.
**Flaw:** Fact-check fails. Signup does NOT go through a guarded `/auth/signup`. The real signup path is the **unguarded** `POST /users` (line 35) and `POST /users/signup-with-onboarding` (line 43) on `UsersController`. If Phase 1 "removes or guards" `POST /users` per the instruction, and the client uses `signup-with-onboarding`, signup either breaks (if guarded — no token exists pre-signup) or the wrong endpoint is removed. The plan also entirely omits `signup-with-onboarding` from the SEC-04 evidence list, so it would be left unguarded by accident — meaning unauthenticated user creation persists after the "fix."
**Failure scenario:** Dev guards `POST /users` with FirebaseAuthGuard → new-user signup returns 401 (no token yet) → registration broken in prod. OR dev only touches `POST /users` and leaves `signup-with-onboarding` open → attacker mass-creates accounts via the un-listed endpoint; the Critical is reported "closed" but isn't.
**Evidence:** `src/users/users.controller.ts:35-37` (`@Post()` no guard), `:43-47` (`@Post('signup-with-onboarding')` no guard — absent from plan). No `auth.controller` signup is referenced by the plan; the cited fix path does not exist as described.
**Suggested fix:** Phase 1 must (a) add `signup-with-onboarding` to the SEC-04 inventory, (b) explicitly keep public signup endpoints public-but-rate-limited/validated rather than auth-guarded, and (c) verify the actual mobile signup call target before removing/guarding `POST /users`.

## Finding 3
**Severity:** High
**Location:** Phase 1 finding table (DB-03, PAY-08 ordering); plan.md Sequencing ("payment race = DB-03 fix lives in P1/P3 seam"); PAY-08 deferred to Phase 2 (Medium).
**Flaw:** DB-03 (atomic payment-status write) is in Phase 1, but **PAY-08 (double-payout race) is deferred to Phase 2** and rated Medium. The payout path is admin-callable and exists today; Phase 1 does not touch the payout gate. So through the entire Phase 1 window (~8 days) two concurrent admin `POST /:id/payout` calls both pass the `payout_completed=false` check and issue two real Stripe payouts. Phase 1 claims "0 Critical money finding open" as its gate, but a real double-money-loss race is left live because it was filed as Medium/Phase-2.
**Failure scenario:** Admin double-clicks payout, or a retry fires after the first Stripe call succeeds but before the DB write commits → two `payouts.create` for the same game → duplicate payout, unrecoverable.
**Evidence:** `src/games/games.service.ts:1441` (`if (game.payout_completed)` read gate), Stripe `createManualPayout` at `:1497`, DB write `payout_completed:true` only at `:1487`/`1514` — no `$transaction`, no `updateMany` optimistic guard, no idempotency key. Confirmed `grep $transaction` absent in this method.
**Suggested fix:** Promote PAY-08 (optimistic `updateMany({where:{id,payout_completed:false}})` + Stripe idempotency key `payout:{game_id}`) into Phase 1 alongside DB-03 — both are the same "atomic money write" class and the payout one is the larger loss.

## Finding 4
**Severity:** High
**Location:** Phase 1 → PAY-01 "interim" fix ("Tạm thời nếu cần giữ endpoint: retrieve PaymentIntent…"); plan.md Open Q1/Q2; PAY-02 deferred to Phase 2.
**Flaw:** Phase 1 offers a "keep the endpoint temporarily" option for `processPlayerPayment` while the canonical-flow decision (PAY-02) is deferred to Phase 2. Keeping a money-mutating endpoint live with a retrofit verification, while the dual-flow custody bug (PAY-02) is unresolved, means the interim verify can pass (`PI.status==='succeeded'`) yet funds sat on the **platform** account (v1 PI, no `transfer_data`) while payout draws from the organizer's **empty connected balance**. The interim fix gives false confidence: "verified paid" ≠ "organizer fundable."
**Failure scenario:** Player pays via v1 platform PI; interim `processPlayerPayment` retrieves PI, sees succeeded, marks paid; payout later fails (insufficient connected balance) or, worse, pays platform money it kept. The Phase-1 gate shows green ("can't mark-paid without Stripe") but the money model is still broken.
**Evidence:** v1 `createPlatformPaymentIntent` has no `transfer_data` — `src/v1/games/games.service.ts:302-310` (`createPlatformPaymentIntent`, currency `'gbp'`, no destination); payout from connected balance `src/games/games.service.ts:1497` (`connectedAccountId: ...stripe_connect_id`).
**Suggested fix:** Do not keep `processPlayerPayment` live in any form during Phase 1 — hard-disable it (rely on verified webhook `handlePaymentIntentSucceeded`), and pull the PAY-02 canonical-flow *decision* (not full impl) into Phase 1 so no money endpoint runs against an undecided custody model.

## Finding 5
**Severity:** High
**Location:** Missed attack surface — not in any phase finding table. Plan mentions `/round/:id`, `/locations` only as Open Question 2 (not as findings).
**Flaw:** `src/users/users.controller.ts` has a **decorator-ordering bug** that the plan never flags: many `@Get(':id/...)` routes are completely unguarded (SEC-16 covers some), but additionally `@Get(':id')` at line 84 places `@UseGuards(FirebaseAuthGuard)` on line 85 — i.e. the guard decorator sits *between* the route decorator and the method, which is valid for that method, but the surrounding routes (`:id/groups`, `:id/feed`, etc.) silently inherit no guard because there is no class-level guard. The plan treats this as a tidy SEC-16 "add guard" list, but does not call out that `UsersController` has **no class-level `@UseGuards`** (unlike `NotificationsController` which does at line 21). That structural absence is the root cause and is the same omission class as SEC-07; missing it risks a partial fix that leaves siblings open.
**Failure scenario:** Dev adds guards to the SEC-16-listed routes but a newly added `:id/*` route ships unguarded again because there is no class-level default — exact recurrence of the SEC-07 pattern the plan claims to be fixing.
**Evidence:** `src/users/users.controller.ts:31` `@Controller('users')` with NO class-level `@UseGuards`; per-method guards scattered (lines 54,61,67,73,85,125,141,147,174); unguarded `:id/groups`(90), `:id/feed`(131), etc. Contrast `src/notifications/notifications.controller.ts:21` class-level guard.
**Suggested fix:** Phase 1/SEC-07 should mandate a class-level `@UseGuards(FirebaseAuthGuard)` default on `UsersController` (and audit every controller for class-level default), then opt-out only the genuinely public routes — not per-route patching.

## Finding 6
**Severity:** High
**Location:** Missed attack surface — `processRefund` PII/authz not in Phase 1; PAY-05 (Phase 2) only addresses refund *amount*.
**Flaw:** The refund path `complaints.service.ts:processRefund` is only critiqued for under-refunding the fee (PAY-05, Medium-ish, Phase 2). The plan misses that refund is initiated through complaints whose **read** endpoint `GET /complaints/games/:gameId` is unauthorized (SEC-05, correctly found) — but SEC-05 is rated High and also deferred (not in Phase 1 Critical table). So through Phase 1, any authenticated user reads all complainant identities + complaint text for any game (moderation/PII leak) while the auth fixes target only conversations/users. Complaints PII is the same IDOR class as SEC-01 (rated Critical) but sits unguarded longer.
**Failure scenario:** Attacker enumerates `gameId`s, harvests complainant names + grievance text across all games during the Phase-1 window — a GDPR-relevant moderation-data breach not closed by the Phase-1 conversation/user fixes.
**Evidence:** `src/complaints/complaints.service.ts` `getGameComplaints` no admin/participant check (cited in research SEC-05 at `complaints.service.ts:130-145`); confirmed `GET /complaints/games/:gameId` only class FirebaseAuthGuard.
**Suggested fix:** Move SEC-05 into Phase 1 (it is functionally a Critical-class IDOR over PII, identical to SEC-01) rather than the deferred High bucket.

## Finding 7
**Severity:** Medium
**Location:** `research/01` SEC-17 Open Q4 ("verify webhook secret not silently skipped") and plan.md Open Q references; PAY-02 Open Q5.
**Flaw:** The research left "does `constructWebhookEvent` silently skip verification if env unset?" as an OPEN question feeding SEC-17 severity. Fact-check resolves it: it does **fail-closed** (throws `InternalServerError` if secret missing) — so the "silent skip → could process unverified webhooks" risk the plan implies as part of SEC-17's impact is **false**. Carrying it as an unresolved Critical-adjacent risk inflates SEC-17 and wastes Phase-5 scope. (Per review rules: verified facts should prune stale risk rows.)
**Failure scenario:** N/A — this is a false-positive risk that should be pruned, not a live vuln. Misallocation of remediation effort.
**Evidence:** `src/stripe/stripe.service.ts:770-783` — `constructWebhookEvent` throws `InternalServerErrorException` when `webhookSecret` is falsy; never calls `constructEvent` without a secret. Both call sites `stripe-webhook.controller.ts:55,142` propagate the throw.
**Suggested fix:** Update SEC-17 / PAY Open Q5: webhook verification is confirmed fail-closed (`stripe.service.ts:770`). Keep env-validation (boot fail-fast) as a convenience, but remove the "skipped verification" impact claim.

## Finding 8
**Severity:** Medium
**Location:** Phase 1 finding table INF-03 wording: "runs `DROP TABLE ... CASCADE` on `$DATABASE_URL`."
**Flaw:** Citation is accurate but the *severity framing* understates a sharper footgun the plan should name: the script derives the drop target from `DATABASE_URL` (the developer's own env, named `DEV_DATABASE_URL`) with **zero host validation** and drops ALL public tables when no `--tables` arg is given. The Phase-1 fix ("guard if URL contains prod host") is good but the more reliable guard — refuse to run unless host ∈ explicit dev allowlist — is only mentioned in passing. A blocklist of "prod host" is bypass-prone (new prod host, replica, pooled connection string).
**Failure scenario:** Engineer with `DATABASE_URL` pointed at a prod read-replica or a renamed prod host runs the script → unconditional `DROP TABLE ... CASCADE` of every public table. Blocklist-style guard ("contains prod host") misses the renamed/replica host.
**Evidence:** `dump-prod-to-dev.sh:59` `DEV_DATABASE_URL="${DATABASE_URL}"`; `:82` parses host into `DEV_HOST`; `:170-178` builds `DROP TABLE IF EXISTS ... CASCADE` for ALL `pg_tables` when no table filter, executed via `psql -h "$DEV_HOST"`. No host allowlist anywhere in 1-90.
**Suggested fix:** Phase 1 INF-03 should specify an **allowlist** (refuse unless host matches `localhost`/known dev hosts) + interactive confirmation, not a prod-host blocklist.

## Finding 9
**Severity:** Medium
**Location:** Phase 5 → SEC infra row "CORS mở hết … `main.ts:42`"; SEC-11; WS CORS not separately tracked.
**Flaw:** The plan tracks HTTP CORS (`app.enableCors()`) for Phase 5 lockdown but does **not** separately track the WebSocket gateway CORS `origin: '*'`. Locking down HTTP CORS while leaving the Socket.IO gateway at `origin: '*'` keeps a browser-reachable cross-origin channel into the (post-SEC-03-fix) chat system. Also a minor citation drift: `enableCors()` is at `main.ts:44` in current source (plan/research say `:42`) — small, but the SEC infra fix could miss the WS gateway entirely.
**Failure scenario:** After Phase-5 CORS whitelist on HTTP, a malicious web origin still opens a Socket.IO connection (gateway `origin:'*'`) and, if SEC-03 was fixed imperfectly (see Finding 1), interacts with chat from any site.
**Evidence:** `src/websockets/chat.gateway.ts:21-22` `cors: { origin: '*' }`; `src/main.ts:44` `app.enableCors()` (plan cites `:42`).
**Suggested fix:** Add WS gateway CORS to the Phase-5 CORS-whitelist task explicitly; correct the `main.ts` line citation.

---

## Confirmed-accurate (fact-check passed, no action)
- SEC-01 `conversations.controller.ts:43` + `:37` — confirmed exact (param-driven, no ownership). ✓
- PAY-01 `games.controller.ts:188-205` + `games.service.ts:1312-1347` — client-trusted, no Stripe verify. ✓
- SEC-04 unguarded `GET /users`(49), `PATCH/DELETE /users/:id`(186/191), `notifications send-all`(107). ✓
- INF-04 `app.module.ts:45` ConfigModule no validationSchema; Swagger ungated `main.ts`; no whitelist on ValidationPipe. ✓
- throttler/helmet absent in `package.json`. ✓
- PAY-05 refund uses `cost_per_player` `complaints.service.ts:277`. ✓
- MOB-04 fake Stripe key fallback `alba-golf-rn-main/api/stripe.ts:374`. ✓

## Unresolved questions
1. Does the production mobile client call `POST /users`, `signup-with-onboarding`, or an `/auth` route for signup? (Blocks Finding 2 fix — required before guarding/removing any signup endpoint.)
2. Is `processPlayerPayment` reachable from the shipped mobile build, or already dead? (Determines whether Finding 4 is live-exploitable today vs. latent.)
3. Are `/round/:id` and `/locations` public-by-design landing/lookup (like `/go`)? (Confirms they are out of IDOR scope.)
