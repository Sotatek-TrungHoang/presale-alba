# Red-Team Plan Review — Scope & Complexity Critic (Contract Verifier)

Target: `plans/260619-1033-production-readiness-gap-analysis` (plan.md + phase-01..07)
Reviewer perspective: hostile YAGNI enforcer + contract verifier.
Verdict: plan is technically sound on findings (most `file:line` claims verified true) but is **over-scoped for a go-live MVP** by ~30-40 man-days. It bundles a post-launch hardening backlog into the go-live gate, and a single unanswered question (canonical payment flow) sits on the critical path of 3 phases without a forcing function.

Evidence collected (verified against source):
- `games.service.ts` = 2200 LOC, `notifications.service.ts` = 1504, `users.service.ts` = 1370 — god-service claim TRUE.
- No `.github/` in either repo — CI-absent claim TRUE.
- `CacheModule` (ttl:0) consumed by exactly ONE service: `courses.service.ts:64,188,234,900` — cache is course-list read perf only.
- `chat.gateway.ts:30` `private rooms = new Map<string, Set<string>>()` keyed by `client.id` (per-socket), NOT global membership; Socket.IO `server.to(...).emit` does the broadcast.
- Backend already has 45 spec files / ~11,253 LOC of tests; `stripe.service.spec.ts`=3379, `game-payout-with-complaints.spec.ts`=767. Money path is the BEST-tested area, not the gap.
- Mobile: 157 source files, exactly ONE test file (`__tests__/utils/test-utils.tsx`, a harness, not a test). Mobile-test gap TRUE.
- `Message` model has no `@@index` on `conversation_id` (verified by awk over schema) — DB-01 TRUE.
- `processPlayerPayment` live at `games.controller.ts:200` → `games.service.ts:1312` — PAY-01 TRUE.

---

## Finding 1
**Severity:** High
**Location:** Phase 5, "Architecture → Scale" + INF-05/06 (`phase-05` lines 25, 35, 51); plan.md go-live gate references Phase 5.
**Flaw:** Redis Socket.IO adapter + Redis cache are scoped as **Crit** infra and sit inside the go-live gate, but they are pure horizontal-scaling enablers with zero value at launch traffic. This is textbook gold-plating that adds an external infra dependency (Redis provisioning, connection mgmt, failure modes) before any traffic exists to justify it.
**Failure scenario:** Team spends 2-4 md standing up Redis + adapter + cache migration + testing cross-instance chat, delaying go-live, to support a multi-instance topology the client may never run. Open Q3 ("1 hay nhiều instance") is still UNANSWERED — so this work is being planned before the precondition that triggers it is even confirmed.
**Evidence:** `CacheModule` (`app.module.ts:59`, ttl:0) is consumed only by `courses.service.ts:64/188/234/900` (course list cache, stale-tolerant, manual `del`). The `rooms` Map (`chat.gateway.ts:30`) is per-`client.id`, not shared membership state — single-instance correctness does not depend on it. Nothing in the money/auth path uses cache.
**Suggested fix:** DEFER both INF-05 and INF-06 to a post-launch backlog. Pin go-live to **1 instance** (Railway supports this). Replace the gate item with a one-line note: "scale to >1 instance requires Redis adapter — not before traffic warrants." Saves ~2-4 md off critical path. Only the in-memory cache `max:100` eviction is worth a 30-min sanity check (course staleness), not a Redis migration.

## Finding 2
**Severity:** High
**Location:** Phase 4, F-05 "Refactor god services" (`phase-04` lines 26, 35, 51, success criterion line 59 "<~800 LOC/đơn vị").
**Flaw:** Splitting `games.service.ts` (2200), `notifications` (1504), `users` (1370) into sub-modules is a maintainability refactor with HIGH regression blast radius and ZERO user-facing or security value. It is explicitly gated behind "after Phase 7 tests exist" (line 35/51), which couples a P2 nicety to the single largest effort item in the plan. A 2200-line file is ugly but ships fine.
**Failure scenario:** Refactor introduces a behavioral regression in the money-critical `games.service` (which holds `processPlayerPayment` and payout-status writes) right before launch, or it simply consumes days that should go to closing Criticals. The "<800 LOC" success criterion is an arbitrary number with no production-readiness link.
**Evidence:** LOC verified (2200/1504/1370). The file size itself causes no runtime defect; all actual Criticals in `games.service` (PAY-01 line 1312, DB-03 lines 1339-1377) are pinpoint fixes that do NOT require splitting the file.
**Suggested fix:** DEFER F-05 entirely to post-launch. Drop the "<800 LOC" gate. Keep only the targeted line-level fixes (PAY-01, DB-03) which are already in Phase 1. Saves ~4-6 md and removes the worst pre-launch regression risk in the plan.

## Finding 3
**Severity:** Critical
**Location:** plan.md Open Question 1 (lines 87) + Phase 1 step 5, Phase 2 step 1, Phase 6 step 1 all depend on "canonical payment flow" decision.
**Flaw:** A single unanswered business question (`/games` platform flow vs `/v1/games` Connect flow) is a hard dependency for Phase 1 (PAY-02 lock), Phase 2 (entire payout refactor), and Phase 6 (mobile contract). The plan documents it as an "open question" but provides no forcing function or default — it can silently block the critical path indefinitely. This is a scope/sequencing defect: the riskiest decision is deferred to "ask the client" with no deadline.
**Failure scenario:** Phase 1 closes all other Criticals, but PAY-02 stays open waiting on the client; Phase 2 cannot start; go-live slips by the client's response latency, not by engineering effort. Squad estimate of "10-13 weeks" assumes an instant answer.
**Evidence:** Two live flows confirmed: `processPlayerPayment` at `games.controller.ts:200`/`games.service.ts:1312` and the v1 flow referenced at `v1/games:298`. Both controllers exist; the plan never proposes which to kill by default.
**Suggested fix:** Convert Open Q1 into a Phase-0 decision spike (0.5 md) with a recommended default ("kill `processPlayerPayment`, standardize on v1 Connect destination charges") so engineering proceeds on the default if the client is silent past a date. Make this the FIRST task, gating nothing else on a client reply.

## Finding 4
**Severity:** High
**Location:** Phase 7, effort "~26d" (`phase-07` line 6); risk note line 62 "~12 md mobile".
**Flaw:** 26 md on tests is the largest single phase and is NOT risk-targeted. The plan's own positive note (line 29) admits backend money/games tests are already strong (verified: 11,253 LOC of specs, stripe spec alone 3379 LOC). Yet Phase 7 budgets broad coverage gates, backend strict-mode migration, and 0-spec modules (notifications/websockets/cron) — much of which is post-launch quality work, not go-live safety.
**Failure scenario:** Team burns ~14 md writing notifications/cron/websocket specs and migrating tsconfig to strict (a yak-shave that surfaces N null-bugs to fix) while the actual launch risk — mobile critical-flow tests (auth, create-round, pay) — is one line item among many. Effort spread thin; launch-blocking mobile coverage under-resourced relative to nice-to-have backend coverage.
**Evidence:** Backend spec inventory verified above. `tsconfig.json:15-16` strictNullChecks/noImplicitAny=false — flipping these is an open-ended refactor. Mobile = 157 sources, 1 non-test harness file.
**Suggested fix:** Split Phase 7. Go-live set (~10-12 md): (a) regression tests for Phase 1/2 money+authz fixes, (b) mobile smoke + 3 critical flows. DEFER to post-launch: backend strict-mode migration (TEST-06), 0-spec module coverage for notifications/cron/websockets (TEST-07), and broad coverage-threshold enforcement beyond money/auth paths. Saves ~10-12 md off go-live.

## Finding 5
**Severity:** Critical
**Location:** plan.md Phases table (lines 51, 54) — Phase 4 and Phase 7 marked **P2**, sequenced "lower risk / parallel after P1".
**Flaw:** Mis-prioritization buried inside P2 phases. Two go-live-CRITICAL items are sitting in low-priority phases: (a) Phase 4 F-03 — `leaderboards` create/update/remove with **NO auth guard** (an unauthenticated write endpoint, a Critical access-control hole) is filed under P2 "code health." (b) Phase 4 F-08 — duplicate `games` vs `v1/games` API surface is the same custody-fork ambiguity that Phase 1/2 treat as Critical PAY-02. A security hole's priority is set by the hole, not by the phase it was cataloged in.
**Failure scenario:** Team treats Phase 4 as deferrable "after P1, lower risk" per the sequencing diagram (plan.md line 73), ships go-live, and the unauthenticated leaderboard-write endpoint remains live — an IDOR/defacement vector identical in class to the SEC-0x Criticals that block launch.
**Evidence:** `leaderboards.controller.ts:21/35/40` (cited in F-03) — no guard. Plan classifies F-03 as "High" inside a P2 phase, contradicting its own Phase 1 rule "0 Critical security finding open" before deploy.
**Suggested fix:** Promote F-03 (leaderboards auth guard) into Phase 1 as a Critical authz fix. It is a 0.5 md guard addition, identical in nature to SEC-04. Leave the rest of Phase 4 (stubs, logging, refactor) in the post-launch backlog.

## Finding 6
**Severity:** Medium
**Location:** Redundant work across Phase 3, 4, 6 — pagination; Phase 4 + 5 — logging.
**Flaw:** Coordination gaps create double-counted effort and conflicting ownership. Pagination appears in Phase 3 (DB-07, "chuẩn hoá cursor/limit"), Phase 4 (F-04 `getMessages` pagination), and Phase 6 (MOB-06 "dùng pagination backend đã có"). Structured logging appears in Phase 4 (F-07 console→Logger) AND Phase 5 (observability/structured logger). No single owner; estimates likely count the same work twice.
**Failure scenario:** Phase 3 builds a cursor pagination helper; Phase 4 independently adds limit/offset to `getMessages` in a different style; mobile (Phase 6) consumes neither consistently. Three half-pagination implementations, contract drift, wasted md.
**Evidence:** DB-01/DB-07 (`chat.service.ts:305` unbounded) is the SAME defect F-04 (`chat.service.ts:304`) cites — both phases claim the `getMessages` pagination fix. Logging: F-07 "201 console.* in prod path" vs Phase 5 "structured logger (đồng bộ Phase 4)" — explicitly cross-referenced but not consolidated.
**Suggested fix:** Consolidate. Pagination = ONE backend task in Phase 3 (helper + apply to chat/posts/notifications), Phase 6 only consumes it. Logging = ONE task in Phase 5 (logger infra), Phase 4 drops F-07 console-replacement into it. Remove the duplicate line items from Phase 4 estimate (~1-2 md double-count).

## Finding 7
**Severity:** Medium
**Location:** Phase 4 F-01/F-02/F-06 — implement-vs-remove stub triage (`phase-04` lines 22-23, 27, 45); plan.md Open Q2.
**Flaw:** Phase 4 budgets implementing course/profile/leaderboard CRUD before confirming any of it is a real feature (Open Q2 explicitly asks "feature thật hay scaffold thừa?"). Implementing scaffold-leftover CRUD that the product doesn't use is gold-plating; the cheaper and safer MVP action is to DELETE/guard, not implement.
**Failure scenario:** Team implements full Course CRUD (`courses.service.ts:180/891/895`) to satisfy "0 route returns placeholder," when the product never exposes course editing — pure wasted effort + new attack surface.
**Evidence:** Plan itself flags these as "stub" and gates them on Open Q2. The default-safe action (remove route / add guard) is ~0.25 md each vs implementing full CRUD (multi-md).
**Suggested fix:** Default to REMOVE or guard-and-hide for all stubs unless PM explicitly confirms the feature is in go-live scope. Make "implement" the exception requiring a confirmed requirement. Reframe success criterion from "0 placeholder" to "0 unguarded/placeholder route reachable in prod."

## Finding 8
**Severity:** Medium
**Location:** Phase 3 success criterion "prisma migrate diff = no drift" + step 5 onDelete/nullable audit (`phase-03` lines 49, 58); Phase 3 DB-05 "FK index diện rộng."
**Flaw:** Mixing one Critical (DB-01 Message index — real full-scan risk) with broad schema-wide hardening (index every FK across 45 models, audit all onDelete/nullable, zero-drift guarantee) inflates Phase 3 to 12 md. At launch traffic, most FK indexes on small/low-traffic tables are premature optimization; "no drift" across 48 migrations is a clean-up nicety, not a launch blocker.
**Failure scenario:** Team adds `@@index` to 35+ FK columns (each a migration needing `CONCURRENTLY` on prod per the plan's own risk note line 61) and chases migration drift, spending days, when only a handful of high-traffic tables (Message, Game, Notification, Post) actually need indexes pre-launch.
**Evidence:** 23 `@@index` directives across 10 models currently; 45 models, 48 migrations. Message-on-`conversation_id` is the only verified hot-path full-scan. Money is already `Int` pence (no float bug — plan confirms).
**Suggested fix:** Go-live set: index Message + the 3-4 highest-traffic FK/sort columns; fix DB-02 (soft-delete leak — a data-exposure bug, correctly Critical); fix DB-06 partial unique (active bug per line 56). DEFER full FK-index sweep, onDelete/nullable audit, and zero-drift to post-launch. Saves ~4-5 md.

## Finding 9
**Severity:** Medium
**Location:** Phase 5 INF-07 Dockerfile multi-stage/non-root/healthcheck + Swagger gating + helmet/throttler (`phase-05` lines 27, 36-37, 53).
**Flaw:** Bundles genuine launch-blockers (env validation INF-04, graceful shutdown INF-02, CI INF-01) with cosmetic container hygiene (multi-stage build, non-root, entrypoint path fix). The container nits are real tech debt but do not block a functioning go-live; mixing them dilutes the phase and pads the estimate.
**Failure scenario:** Phase 5 reads as a 15 md monolith; PM defers the whole thing if time is tight, losing the actual Criticals (graceful shutdown — verified absent, causes dropped requests on Railway redeploy) along with the cosmetics.
**Evidence:** INF-02/04 verified as real (no `enableShutdownHooks`, no `validationSchema` at `app.module.ts:45`). Dockerfile non-root/multi-stage is a hardening preference with no functional launch impact.
**Suggested fix:** Within Phase 5, tag a hard go-live subset: CI (INF-01), graceful shutdown (INF-02), env validation (INF-04), helmet+throttler+CORS+Swagger-gate (security infra — keep, cheap & high value). Move Dockerfile multi-stage/non-root/entrypoint-path to post-launch hygiene. Keeps the Criticals visible.

---

## Recommended go-live MVP cut (summary)

KEEP in go-live gate: Phase 1 (all), Phase 2 (canonical flow + hold/payout/refund — the money lifecycle), Phase 3 (DB-01 Message index, DB-02 soft-delete leak, DB-06 partial unique only), Phase 5 (CI, graceful shutdown, env validation, helmet/throttler/CORS/Swagger), Phase 6 (MOB-01..05 contract+auth+ErrorBoundary+stripe key), Phase 7 (Phase1/2 regression tests + mobile critical-flow smoke). Plus promote Phase 4 F-03 (leaderboards guard) into Phase 1.

DEFER to post-launch backlog: INF-05/06 Redis (F1), F-05 god-service refactor (F2), broad Phase 7 backend strict-mode + 0-spec module coverage (F4), Phase 4 stub-implementation + logging-as-separate (F6/F7), broad FK index sweep + drift cleanup (F8), Dockerfile cosmetics (F9).

Estimated go-live reduction: ~30-40 md off the ~110-120 md figure.

## Unresolved questions
1. Open Q1 (canonical payment flow) MUST get a default + deadline — it is the true critical-path blocker (F3).
2. Open Q3 (instance count) — if confirmed "1 instance," F1 (Redis) is settled as DEFER; the plan should state the default assumption rather than leave it open.
3. Are course/profile/leaderboard CRUD actual go-live features? (F7) — drives whether stubs are implemented or deleted.
