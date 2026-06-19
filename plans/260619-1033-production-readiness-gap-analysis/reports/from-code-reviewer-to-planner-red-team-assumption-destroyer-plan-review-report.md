# Red-Team Plan Review — Assumption Destroyer / Scope Auditor

**Target:** `plans/260619-1033-production-readiness-gap-analysis` (plan.md + phase-01..07)
**Perspective:** Hostile. Skeptic on unstated deps + false "works/clean" claims; Scope Auditor on what-exists claims.
**Method:** Every finding grep/read-verified against `alba-social-backend-main` + `alba-golf-rn-main`. No style nits.

Net: the plan's core security/money findings are largely REAL and well-cited. The damage is in (a) overstated failure scenarios that inflate severity, (b) "already implemented" code the plan claims is absent, (c) hidden infra/release dependencies treated as code-only, and (d) fantasy estimates. Several "open questions" are not minor — they gate whole phases.

---

## Finding 1
**Severity:** High
**Location:** phase-01, findings table, PAY-01 ("→ mark-paid free, trigger payout thật")
**Flaw:** PAY-01 evidence claims the client-trusted `processPlayerPayment` lets one request "trigger a real payout." It does not. The method only writes `has_paid/payment_amount/payment_status` and sends notifications — it never calls Stripe payout. Payout is a separate path (`processGamePayout`) requiring `status === COMPLETED`, no open complaints, and admin auth.
**Failure scenario:** Reviewer/PM reads "1 request → real payout," treats PAY-01 as immediate fund-loss, and the team may over-engineer a fix or mis-rank it vs other criticals. The *actual* risk is corrupted `has_paid` state that could later feed an unfunded payout — a different, slower failure mode that the plan never names.
**Evidence:** `src/games/games.service.ts:1312-1404` (only sets has_paid + notifies, returns `findOne`); payout lives at `games.service.ts:1408 processGamePayout` (guards COMPLETED + complaints + admin). Route is `games.controller.ts:188` and is in fact behind `FirebaseAuthGuard` + self-check `if (user.id !== playerId) throw ConflictException` (controller:196) — which the finding table omits, further softening "free."
**Suggested fix:** Re-state PAY-01 as "client can fake payment status (no Stripe amount verification)"; move the payout-coupling risk into PAY-03/hold logic. Drop "trigger payout thật."

## Finding 2
**Severity:** High
**Location:** phase-02, findings table PAY-06/PAY-08 + step 4 ("completed chỉ qua payout.paid webhook; payout.failed reopen")
**Flaw:** The plan implies payout webhook handlers are missing and must be built. They already exist: `handlePayoutPaid`, `handlePayoutFailed`, `handlePayoutPending`, with idempotency. The real, narrower bug is that `handlePayoutFailed` updates only the `Transaction` record to FAILED and never resets `game.payout_completed = false` — so the *game* stays stuck "completed." Estimating PAY-06 as if greenfield mis-sizes it.
**Failure scenario:** Team budgets/builds a full payout-webhook lifecycle that 80% exists, duplicating handlers and risking double-write regressions, while the actual one-line gap (game reopen on payout.failed) gets buried.
**Evidence:** Handlers at `stripe.service.ts:1894 handlePayoutPaid`, `:2061 handlePayoutFailed`, both with `transactionEventLog` idempotency (`:1912`, `:2079`). `handlePayoutFailed` body (`:2061-2193`) touches only `transaction`/`transactionEventLog`, no `game.update`. `payout_completed` is written only in `games.service.ts:1487,1517` (set true), never set false from a webhook.
**Suggested fix:** Re-scope PAY-06 to "payout.failed handler does not reopen game.payout_completed"; keep existing handlers, add the game-state reopen + reconcile.

## Finding 3
**Severity:** Critical
**Location:** phase-02, "Webhook signature + idempotency = verified OK, giữ nguyên" (and reused in P1 framing)
**Flaw:** The "verified OK" idempotency claim is correct for the per-handler dedup, BUT the plan glosses that `processGamePayout` (the payout *initiation* path, not the webhook) is NOT transactional and has a non-atomic guard — a real double-payout vector the plan files under PAY-08 "non-transactional" but never pins to the actual race: the `payout_completed` pre-check and the post-Stripe DB write are separate statements with no row lock.
**Failure scenario:** Two concurrent admin/cron payout triggers both read `payout_completed=false` (`:1441`), both call Stripe `createManualPayout`, both then set true. Two real payouts, one game. Webhook idempotency does not protect this because it's the *outbound* payout, not an inbound event replay.
**Evidence:** `games.service.ts:1441` (`if (game.payout_completed) throw`) is a plain read; Stripe call `:1498 createManualPayout`; DB mark `:1487/:1517 prisma.game.update({payout_completed:true})` — all outside any `$transaction`/`SELECT ... FOR UPDATE`/optimistic guard.
**Suggested fix:** State PAY-08 concretely as "non-atomic check-then-payout in processGamePayout"; fix with advisory lock or `update ... where payout_completed=false` returning affected-rows before calling Stripe.

## Finding 4
**Severity:** Critical
**Location:** phase-02, PAY-03 + Architecture ("thêm scheduled job theo kiến trúc cron one-shot hiện có") and Open Q3
**Flaw:** Treated as a code task. The existing cron architecture is **Railway-managed one-shot processes** — each job is a separate Railway cron service configured in the Railway dashboard, NOT an in-process scheduler (there is no `@nestjs/schedule`). A new payout-hold runner therefore REQUIRES provisioning a new Railway cron entry = infra/deploy access + Q3 (Railway confirmed? who owns the dashboard?). No error path is defined for "runner deployed but Railway cron not scheduled" → silent no-payouts.
**Failure scenario:** Dev ships `payout-hold.runner.ts`, tests pass locally, but nobody wires the Railway cron. In prod, no payouts ever fire; funds strand silently with zero error. The plan's success criterion "game >2d tự payout" passes in unit test but fails in prod.
**Evidence:** `CRON.md:1-25` ("one-shot processes… Railway runs the command on a cron schedule… No always-on scheduler lives inside the API server"); `package.json:24` only `cron:notifications` script; `src/cron/` has only notification runner; no `@nestjs/schedule` dep. Also an existing `payout-on-its-way` job already assumes "day after completed round" — overlaps/contradicts the unbuilt "2-day hold" timing and is unreconciled.
**Suggested fix:** Make PAY-03 explicitly cross-functional (code + Railway cron provisioning + Q3 answer as a blocker, not a side note); add a startup/health assertion that the hold job ran recently. Reconcile 2-day hold vs existing `payout-on-its-way` cadence.

## Finding 5
**Severity:** High
**Location:** phase-06, MOB-01 "thêm EVENING vào backend enum" and "~25 endpoint align"
**Flaw:** Two scope errors. (1) The Prisma `TimeSlot` enum ALREADY contains `EVENING`; the mismatch is only in the hardcoded TS union in `CreateGameDto` (and that field has no `@IsIn` validator on create), so the suggested "add EVENING to backend enum" implies a DB migration that is not needed and the 400 cause is mis-attributed. (2) The mismatch is broader than the table shows: backend slots are `EARLY_MORNING|LATE_MORNING|LUNCHTIME|LATE_AFTERNOON` (no plain AFTERNOON), while mobile uses EVENING and other labels — a label-set divergence, not a single missing value.
**Failure scenario:** Team writes a Prisma migration to add an enum value that exists, wastes a migration + review cycle, and still ships create with no validator (so EVENING may pass silently into a column, or a different slot mismatch breaks). The "0 contract mismatch" gate is declared met against an incomplete matrix.
**Evidence:** `schema.prisma:622-627` enum includes `EVENING`; `create-game.dto.ts:15` union excludes it AND has no `@IsIn` decorator (vs `update-game.dto.ts:69` which does); mobile `select-time-slot.tsx:32 id:"EVENING"`. Backend has `LUNCHTIME`, mobile/onboarding uses `AFTERNOON`/`EVENINGS` variants (`onboarding/step5.tsx:317,459`).
**Suggested fix:** Re-scope MOB-01 to "DTO union + missing create validator," redo the full slot-label matrix both directions before claiming alignment.

## Finding 6
**Severity:** High
**Location:** plan.md severity rollup + phase-07 effort "~26d / mobile ~12md"; plan total "~110–120 man-days"
**Flaw:** Fantasy estimate for mobile testing. Going from effectively zero tests to "smoke render all main screens + critical-flow tests + 70% coverage *enforced*" across 162 source files / 34,272 LOC in ~12 md is not credible — that's ~2,850 LOC/day to bring under test including harness setup (jest-expo, RN Testing Library, native mocks for Stripe/Firebase/Mapbox). Realistic harness + meaningful critical-flow coverage on a 34K-LOC Expo app is closer to 20-30 md, and "70% enforced" likely 40+.
**Failure scenario:** Squad commits to a 10-13 week timeline anchored on this number; mobile test phase slips 2-3x, blowing the go-live date that the plan's "Definition of Ready" gates on Phase 7.
**Evidence:** `alba-golf-rn-main`: 162 ts/tsx source files, 34,272 LOC (find+wc), `__tests__/` contains only `utils/test-utils.tsx` (no real specs). Native integrations requiring mocks: Stripe, Firebase, Mapbox (MAPBOX_SETUP.md, firebase.config.js present).
**Suggested fix:** Split mobile testing into "critical-flow smoke (go-live gate, ~10md)" and "70% coverage (post-launch, ~20md+)". Do not gate go-live on full coverage. Re-derive the 110-120 total after this correction.

## Finding 7
**Severity:** High
**Location:** plan.md "Open questions" (treated as estimate-blockers, but listed as routine); specifically Q1 (canonical flow) and Q3 (instance count)
**Flaw:** Q1 and Q3 are not clarifications — they are hard prerequisites that block the *design* of Phase 2 and Phase 5, which several other phases depend on. The plan acknowledges P2→P6 coupling but still assigns concrete effort (~11d, ~15d) and a sequencing diagram as if the answers exist.
**Failure scenario:** Phase 2 starts, picks destination charges, builds hold/payout around it; client later says "we use separate charges+transfers" → custody model + payout source + reconciliation all rebuilt, and Phase 6 mobile contract re-cut. Phase 5 builds single-instance, then Q3 says "3 instances" → Socket.IO + cache rearchitected (Redis adapter) mid-stream with no error path defined for the adapter (Redis down = WS silently degrades).
**Evidence:** plan.md:87-89 (Q1 canonical flow, Q3 instance count). PAY-02 cites two contradictory flows live: `v1/games:298` (PaymentIntent w/o transfer_data) vs payout from connected balance `stripe.service.ts:1060`. phase-05 Redis adapter is conditional on Q3 with no fallback/health-check path specified.
**Suggested fix:** Promote Q1 and Q3 to "blocking — answer before Phase 2/5 estimate is valid." Add an explicit error/degradation path for the Redis adapter (fail-fast at boot vs silent in-memory fallback).

## Finding 8
**Severity:** Medium
**Location:** phase-03 "Verified positive: $transaction đã dùng ở 16 chỗ" + soft-delete extension approach; phase-01 DB-03
**Flaw:** The "16 places use $transaction" positive is presented as reassurance, but the audit's own criticals (PAY-08, DB-03) prove the pattern is applied to the *wrong* places — the money paths that most need atomicity are exactly the ones NOT wrapped. Counting transaction usage without checking it covers the financial writes is a misleading "clean" signal. Separately, the proposed global Prisma soft-delete extension is flagged "có thể đổi hành vi query hiện hữu" but no error path is given for queries that *intend* to read soft-deleted rows (e.g., admin/restore, reconciliation) — a global filter can silently hide rows those flows depend on.
**Failure scenario:** Reader trusts "transactions exist," under-prioritizes DB-03/PAY-08. Then global soft-delete extension ships and breaks an admin restore or a reconciliation query that needs deleted rows, with no compile-time signal.
**Evidence:** `processGamePayout` (`games.service.ts:1441-1525`) and `processPlayerPayment` (`:1339-1377`) — the two financial writes — are NOT in `$transaction`, despite the 16-usage claim. phase-03 Architecture proposes a global extension with only a generic "rollout có test + cờ" caveat.
**Suggested fix:** Reframe the positive as "transactions used in 16 non-critical places; financial paths missing them." For the soft-delete extension, mandate an explicit `includeDeleted` escape hatch and enumerate the flows that need it before global rollout.

## Finding 9
**Severity:** Medium
**Location:** phase-01, INF-03 (`dump-prod-to-dev.sh` DROP TABLE) grouped as P0 alongside IDOR/money
**Flaw:** Severity inflation / threat-model mismatch. INF-03 is a *developer-operated local script*, not a request-reachable endpoint. The plan's verdict framing ("mất tiền/lộ dữ liệu chỉ với 1 request") lumps this script into the same "1 request" bucket as SEC-01..04, but no external actor can invoke it — it requires shell access + running it. It belongs in ops-hardening, not the same tier as unauthenticated IDOR.
**Failure scenario:** Minimal external risk; but mis-tiering consumes P0 budget/attention. Conversely, if it stays in P0 it's the easiest "critical" to close, creating false progress on the go-live gate while real request-reachable criticals remain.
**Evidence:** `dump-prod-to-dev.sh:175` is a CLI script (not a controller/route); not imported by any Nest module. Contrast SEC-01/02 which ARE request-reachable: `conversations.controller.ts:38 getConversations(@Param('userId'))` and `:43 getMessages(@Param('conversationId'))` — both take IDs from URL with only `FirebaseAuthGuard` (authn) and no participant/ownership check (verified Critical, real).
**Suggested fix:** Keep INF-03 as a fix but down-tier to High ops-safety; reserve "1 request" criticality language for request-reachable findings. (Note: SEC-01/02 IDOR, AdminGuard fail-closed at `admin.guard.ts:21-39`, and Int-for-money at `schema.prisma:375,414,748` all verified accurate — those claims hold.)

---

## Verified-accurate claims (for fairness, not praise)
- AdminGuard IS fail-closed behind FirebaseAuthGuard — `admin.guard.ts:21-39`. But note `notifications/send-all` (`notifications.controller.ts`) is currently NOT decorated with it; the fix is real.
- Int-for-money, no Float bug — `schema.prisma:375,414,748`.
- SEC-01/02 IDOR — `conversations.controller.ts:38,43`. Real Critical.
- Webhook per-handler idempotency inside `$transaction` (executeWithRetry → `$transaction`) — `stripe.service.ts:46-55,1362-1368`. Holds.
- No graceful shutdown / wide CORS / always-on Swagger — `main.ts:42` (`enableCors()` no args), Swagger `:40-41`, no `enableShutdownHooks`, no `OnModuleDestroy` in `prisma.service.ts`. INF-02/INF-04 accurate.
- Mobile ~0 tests — only `__tests__/utils/test-utils.tsx`. TEST-01 accurate.
- Backend non-strict TS — `tsconfig.json` `strictNullChecks:false, noImplicitAny:false`. TEST-06 accurate.

## Unresolved questions
1. Does any client (mobile/web/admin) actually call the client-trusted `POST /games/:id/players/:playerId/payment`? Mobile uses `/games/:id/payment` + `/payment-details` only (`api/games.ts:352,378`). If nothing calls it, PAY-01 fix = delete the route (cheaper than the plan's "retrieve + verify" path).
2. Who owns the Railway dashboard / cron provisioning? Phase 2 PAY-03 cannot land without it.
3. Does `create-game.dto.ts` actually 400 on EVENING, or does the missing `@IsIn` let it through? Changes MOB-01 from "contract break" to "silent bad-data."
