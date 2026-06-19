# Red-Team Plan Review — Failure-Mode Analyst / Flow Tracer

**Reviewer role:** Hostile reviewer. Perspective = Failure Mode Analyst (Murphy's Law). Verification = Flow Tracer.
**Target:** `plans/260619-1033-production-readiness-gap-analysis/` (plan.md + phase-01..07).
**Codebase verified:** `alba-social-backend-main` (grep/read). Mobile not re-verified (findings below are backend/flow-centric).
**Method:** Traced execution/data flow through cited code; every finding carries `file:line` evidence. No praise. Style skipped.

---

## Finding 1 — Plan cites a non-existent file path for the single most-referenced module (chat)
**Severity:** High
**Location:** Phase 1 §Related Code Files (l.39); Phase 3 Findings table (l.24–25), §Related Code Files (l.41), Steps (l.45); Phase 4 §Related Code Files (l.39); research/05 (DB-01/02 evidence).
**Flaw:** Plan repeatedly directs implementers to `src/chat/chat.service.ts`. That directory does not exist. The real file is `src/websockets/chat.service.ts`. DB-01/DB-02/SEC-01 all hinge on this file. An implementer following the plan greps `src/chat/`, finds nothing, and may conclude the bug is already fixed or wrong-patches a different file.
**Failure scenario:** Phase 1 SEC-01 (IDOR) "fixed" against a non-existent path → CI green (nothing changed) → IDOR ships to prod. The go-live gate ("0 Critical open") passes on a phantom fix.
**Evidence:** `ls src/chat/` → "NO src/chat/ DIR"; actual `getMessages` at `src/websockets/chat.service.ts:304`; no `deleted_at` filter, no `take`/pagination in that method body (l.304–316).
**Suggested fix:** Global find/replace `src/chat/` → `src/websockets/` across all phase docs and research/05. Re-verify every chat `file:line` citation against the real path before estimating.

---

## Finding 2 — Payout double-spend not actually closed: fix omits Stripe idempotency key (DB-fix alone is insufficient)
**Severity:** Critical
**Location:** Phase 1 Step 6 (DB-03, l.51) + Phase 2 Findings PAY-08 (l.26) / Step 4 (l.47).
**Flaw:** Plan's remediation for double-payout = "bọc `$transaction` + status guard". Trace the live flow: `processGamePayout` reads `game.payout_completed` (`games.service.ts:1441`), calls `stripeService.createManualPayout(...)` (l.1499), THEN sets `payout_completed=true` (l.1512). `createManualPayout` calls `this.stripe.payouts.create(...)` (`stripe.service.ts:1059`) with **no `idempotencyKey`**. A DB transaction wrapping the read-check-write does NOT make the *external Stripe call* idempotent. If the request times out after Stripe creates the payout but before the DB commit, the client retries, the DB still shows `payout_completed=false`, and a **second real payout** is issued. Transaction scope cannot protect a side-effect that lives outside the DB.
**Failure scenario:** Network blip / Railway redeploy mid-request (see Finding 6) → retry → two payouts to the organiser's connected account → real money lost. The plan's own success criterion "Double-trigger payout không tạo payout thứ 2" would pass the optimistic-lock unit test yet fail in production on the timeout path.
**Evidence:** `stripe.service.ts:1059-1071` (`payouts.create` with only amount/currency/description/metadata — no idempotency options); `games.service.ts:1441` (read), `:1499` (Stripe call), `:1512` (DB write) — all outside any `$transaction`.
**Suggested fix:** Add a deterministic Stripe `idempotencyKey` (e.g. `payout_${gameId}`) to `payouts.create`. Add a "payout-intent" row written *before* the Stripe call (status=PENDING) and reconciled by the `payout.paid`/`payout.failed` webhooks. The DB transaction is necessary but not sufficient — state PAY-08 explicitly as "DB tx + Stripe idempotency key + pre-write intent row," all three.

---

## Finding 3 — Plan claims payout lifecycle has no `payout.failed` reopen + sets completed immediately; webhook handlers already exist — fix risks regressing working code
**Severity:** High
**Location:** Phase 2 Findings PAY-06 (l.25) + Step 4 (l.47): "completed chỉ qua `payout.paid` webhook; `payout.failed` reopen."
**Flaw:** The plan presents PAY-06 as missing functionality to build. Tracing the code, `handlePayoutPaid` (`stripe.service.ts` ~l.1931–2060) and `handlePayoutFailed` (~l.2098–2192) BOTH already exist, both wrapped in `$transaction`, both writing `TransactionEventLog`. The real defect is narrower: `processGamePayout` *also* sets `payout_completed=true` synchronously at `games.service.ts:1512` (before any webhook), so the game-level flag and the transaction-level status are two competing sources of truth. The plan's framing ("not implemented") will cause an implementer to rebuild handlers that exist, risking a regression of the verified-good webhook path, while leaving the actual dual-source-of-truth bug unaddressed.
**Failure scenario:** Implementer rewrites payout webhooks from scratch → breaks the existing `stripe_event_id` dedup contract (Finding 7) → webhook replay double-processes. Meanwhile `game.payout_completed=true` stays set even after `payout.failed`, so the auto-payout cron (Phase 2 PAY-03) skips the game → stranded funds.
**Evidence:** `stripe.service.ts:2014` (`stripe_event_type: 'payout.paid'` log write), `:2175` (`payout.failed` log write); `games.service.ts:1512` (`payout_completed: true` set synchronously, independent of webhook).
**Suggested fix:** Re-scope PAY-06 to "reconcile `game.payout_completed` with webhook-driven transaction status; do NOT set the flag synchronously; reopen the flag on `payout.failed`." Mark the existing webhook handlers as verified-keep, like the inbound dedup.

---

## Finding 4 — Global soft-delete Prisma extension (Phase 3) has 287-site blast radius and silently mutates the payout/auth read paths
**Severity:** Critical
**Location:** Phase 3 §Architecture "Soft-delete enforcement" (l.32) + Step 1 (l.45); Risk note l.62 ("có thể đổi hành vi query hiện hữu → rollout có test + cờ").
**Flaw:** Plan proposes a global Prisma Client Extension/middleware that defaults `deleted_at != null` exclusion on all reads. There are **287 existing explicit `deleted_at: null` filters** in `src/`. A global filter layered on top changes the semantics of every one of them — including money- and auth-critical reads. `processGamePayout` explicitly filters `players: { where: { deleted_at: null } }` (`games.service.ts:1421`) and the payout amount is computed from that player set (l.1477). If the extension and the Phase 2 payout refactor land in parallel (plan says "Phase 3 nên đi cùng Phase 2", l.79), the player set feeding the payout sum can shift under the payout author's feet. The Risk note treats this as a soft "behavior change," not the money-correctness hazard it is.
**Failure scenario:** Extension changes which `GamePlayer` rows are visible mid-Phase-2 → payout total recomputed over a different player set → over/under-payout, or webhook idempotency lookups on soft-deletable `TransactionEventLog` (it has `deleted_at`, schema l.808) start filtering rows → replayed webhook processed twice.
**Evidence:** `grep -c "deleted_at: null" src/` = 287; `games.service.ts:1421` (player filter) + `:1477` (payout sum over that set); `prisma/schema.prisma:808` (`TransactionEventLog.deleted_at`).
**Suggested fix:** Do NOT parallelize Phase 3 soft-delete extension with Phase 2 payout work. Land the extension as a standalone, behind a per-model allowlist (not global), with a regression suite over the 287 sites — money/auth tables opted-in last. Sequence: Phase 2 freezes payout read paths → Phase 3 extension → re-verify payout. Update plan.md sequencing (l.79).

---

## Finding 5 — Partial unique index migration (DB-06) contradicts Phase 3's own "no drift" success criterion and lacks rollback for in-flight duplicate rows
**Severity:** High
**Location:** Phase 3 §Architecture "Unique + soft-delete" (l.34), Step 3 (l.47), Success Criteria l.58 ("`prisma migrate diff` = no drift").
**Flaw:** Converting `@@unique([user_id, game_id])` etc. to a partial unique index (`WHERE deleted_at IS NULL`) requires raw SQL — Prisma's schema DSL cannot express partial unique indexes, so `prisma migrate diff` will *permanently* report drift between schema and DB. This directly contradicts the phase's own success criterion (l.58). Worse: the migration that DROPs the full unique and CREATEs the partial has a gap. If the table already contains rows that violate the partial constraint (an active soft-deleted + re-created pair — which DB-06 says is the live GamePlayer-on-decline bug per l.56), the `CREATE UNIQUE INDEX` fails and the migration half-applies (old constraint dropped, new not created) → table left with NO uniqueness protection.
**Failure scenario:** Migration runs on prod, `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` errors on existing duplicate live rows → deploy aborts after `DROP CONSTRAINT` succeeded → window with zero uniqueness → concurrent joins create duplicate `GamePlayer` rows → payout sum (Finding 4) double-counts a player.
**Evidence:** `prisma/schema.prisma:425` (`@@unique([user_id, game_id])`), `:146` (Follow), `:531` (Like), `:990` (Block); Phase 3 l.56 states GamePlayer soft-delete-on-decline is an active bug (i.e. dup rows likely already exist).
**Suggested fix:** Pre-migration data cleanup step (dedupe live rows) BEFORE creating the partial index, in the same transaction or guarded. Wrap DROP+CREATE so a CREATE failure rolls back the DROP. Drop the "no drift" criterion or document the expected partial-index drift exception. Add explicit down-migration.

---

## Finding 6 — Index migrations on the largest table take ACCESS EXCLUSIVE locks; no migration is `CONCURRENTLY` and no maintenance-window gate exists in the plan's steps
**Severity:** High
**Location:** Phase 3 Step 2 (l.46, "thêm `@@index` cho `Message.conversation_id`... tạo & test migration"); Risk note l.61 ("cần `CONCURRENTLY`/maintenance window").
**Flaw:** Phase 3 implementation Step 2 says to add the index via standard Prisma migrate, which emits a plain `CREATE INDEX` (ACCESS EXCLUSIVE lock, blocks all writes to `Message` for the duration). `Message` is named as the largest table (DB-01). Zero existing migrations use `CONCURRENTLY` (grep: none across 49 migration dirs). The need for `CONCURRENTLY` is buried in the Risk section but the *implementation step* gives the dangerous instruction. Prisma cannot run `CREATE INDEX CONCURRENTLY` inside its migration transaction — it needs a hand-written non-transactional migration. The plan does not call this out as a step.
**Failure scenario:** Deploy runs `CREATE INDEX` on `Message` during traffic → chat writes block for the lock duration → Socket.IO message sends time out → user-visible chat outage. Combined with Finding 2 (no graceful shutdown), an aborted deploy mid-index can leave the migration half-applied.
**Evidence:** `grep -rln CONCURRENTLY prisma/migrations` = none; 49 migration dirs; `src/websockets/chat.service.ts:304` (unbounded Message read confirms table is hot+large).
**Suggested fix:** Promote `CONCURRENTLY` from Risk to a mandatory implementation step: hand-author the Message/large-table index migrations as non-transactional raw SQL with `CONCURRENTLY`, run outside Prisma's tx, with a maintenance-window or low-traffic gate. Add rollback (`DROP INDEX CONCURRENTLY`).

---

## Finding 7 — No graceful shutdown means EVERY migration/payout deploy can half-apply or double-fire (cross-cutting recovery gap)
**Severity:** Critical
**Location:** Phase 5 INF-02 (l.23, Step 2 l.49); interacts with Phase 2 payout and Phase 3 migrations.
**Flaw:** Confirmed: no `enableShutdownHooks`, no Prisma `$disconnect`, no SIGTERM drain in `main.ts`/`prisma.service.ts`. The plan correctly identifies INF-02 but schedules it in Phase 5 as "independent, start early in parallel" (plan.md l.71), AFTER Phases 1–3 which perform the riskiest money/schema writes. Sequencing is backwards: graceful shutdown is the *prerequisite* that makes the Finding 2 payout retry and Finding 6 migration safe. Doing money/migration work first, on an infra that aborts in-flight requests on every Railway redeploy, maximizes the half-apply window during exactly the phases that handle money and schema.
**Failure scenario:** During Phase 2 deploy, Railway sends SIGTERM mid-`processGamePayout` (Stripe call sent, DB write not committed) → process killed → no retry safety (Finding 2) → double payout on next attempt. During Phase 3 deploy, SIGTERM mid-`CREATE INDEX`/constraint swap → half-applied schema (Finding 5).
**Evidence:** `grep enableShutdownHooks|SIGTERM|OnModuleDestroy|$disconnect src/main.ts src/prisma/prisma.service.ts` = no matches.
**Suggested fix:** Move INF-02 (graceful shutdown + `$disconnect` + SIGTERM drain) to **Phase 1**, ahead of all money/schema mutations. Treat it as a go-live *prerequisite for safely deploying the other phases*, not parallel infra polish.

---

## Finding 8 — INF-03 dump-script claim is imprecise: a confirmation prompt already exists; real hazard (DATABASE_URL=prod) is understated
**Severity:** Medium
**Location:** Phase 1 INF-03 (l.29, "chạy `DROP TABLE ... CASCADE` trên `$DATABASE_URL`, không guard host/env"), Step 7 (l.52).
**Flaw:** Two inaccuracies. (1) The script DROPs against `DEV_DATABASE_URL` which is sourced from `$DATABASE_URL` (`dump-prod-to-dev.sh:59`) — there IS already a `read -p "Continue? (y/n)"` confirmation gate (l.123) before any destructive action; the plan says "không guard" (no guard), which is false. (2) The real, unmitigated hazard is that `DATABASE_URL` is the *dev* target by convention, so if a developer's shell has `DATABASE_URL` pointing at prod, the existing prompt is the only thing between them and dropping prod — a human-error trap, not an unconditional auto-drop. The plan's cited line (`:175`) is the psql exec; the destructive SQL is built at l.169 and executed l.176.
**Failure scenario:** Implementer "adds a guard" believing none exists, duplicates the prompt, and still doesn't address the actual `DATABASE_URL=prod` misconfiguration → false sense of safety, prod still droppable.
**Evidence:** `dump-prod-to-dev.sh:59` (`DEV_DATABASE_URL="${DATABASE_URL}"`), `:123` (`read -p "Continue? (y/n)"`), `:169-176` (DROP SQL build + psql exec).
**Suggested fix:** Correct INF-03 wording: "confirmation exists but no host whitelist; drops whatever `DATABASE_URL` points to." Real fix = refuse to run if `DATABASE_URL` host matches `PROD_DATABASE_URL` host or any prod-host denylist; require an explicit `--i-know-this-is-dev` flag in addition to the prompt.

---

## Finding 9 — PAY-02 "canonical flow" premise is partly false: v1 PaymentIntent DOES set transfer_data; refactor scoped on a wrong assumption
**Severity:** High
**Location:** Phase 1 PAY-02 (l.27, "v1 tạo PaymentIntent không `transfer_data` nhưng payout rút từ connected balance chưa được fund"); Phase 2 PAY-02 (l.22), Step 1 (l.44, "refactor để custody ↔ payout source khớp; xoá flow thừa").
**Flaw:** The plan's stated root cause — v1 creates a PaymentIntent *without* `transfer_data`, so the connected balance is never funded yet payout draws from it — is contradicted by the code. `createPlatformPaymentIntent` sets `transfer_data: { destination: recipientStripeAccountId }` (`stripe.service.ts:1175`), i.e. it IS a destination charge that funds the connected account. The connected account is created with `payouts.schedule.interval: 'manual'` (`stripe.service.ts` ~l.553) and Alba acts as merchant-of-record via destination charges (code comment l.543-546). So the custody model is more coherent than PAY-02 asserts. The genuine fork is between this destination-charge v1 path and the *legacy* `processPlayerPayment` (client-trusted, no Stripe verify) path. Scoping a large "custody ↔ payout source mismatch" refactor on a false premise risks an unnecessary blast-radius rewrite of working money code.
**Failure scenario:** Phase 2 Step 1 "xoá flow thừa" deletes/rewrites the destination-charge path believing it's unfunded → breaks the actually-correct funding mechanism → live payments stop funding connected accounts → real stranded funds, the exact outcome the phase is meant to prevent.
**Evidence:** `stripe.service.ts:1175-1176` (`transfer_data: { destination: recipientStripeAccountId }`); `:543-546` (merchant-of-record destination-charge comment); `:553` (`schedule.interval: 'manual'`); legacy non-verifying path at `games.service.ts:1322` (`processPlayerPayment`, trusts client `amount`/`paymentIntentId`).
**Suggested fix:** Re-verify PAY-02 against `stripe.service.ts:1175`. Re-scope to: "deprecate the client-trusted `processPlayerPayment` legacy path (PAY-01); keep the destination-charge v1 path as canonical." Do not frame it as "v1 is unfunded." Confirm Open Q1 answer against this corrected model before any deletion.

---

## Finding 10 — Sequencing diagram parallelizes Phase 2/3/6 across shared money files, creating merge/semantic conflicts the plan doesn't gate
**Severity:** Medium
**Location:** plan.md §Sequencing & dependencies (l.67–79); Phase 3 dependencies `[]` (l.7) vs Phase 2 touching same files.
**Flaw:** Phase 3 declares `dependencies: []` and the diagram runs Phase 3 in parallel with Phase 2, but both modify the payout read paths in `games.service.ts` (Phase 2: payout lifecycle l.1407-1520; Phase 3: transaction-wrapping "multi-step writes còn thiếu" Step 6 + soft-delete semantics over the same player reads). Phase 6 contract fixes depend on Phase 2's Open-Q1 decision (correctly noted) — but Phase 6 also can't begin enum work until PAY-02's corrected model (Finding 9) settles which route is canonical. Parallel edits to `games.service.ts` by Phase 2 and Phase 3 authors = merge conflicts at minimum, and at worst the Finding 4 semantic drift (one author adds a `$transaction`, the other changes row visibility inside it).
**Failure scenario:** Phase 2 and Phase 3 land same week → `games.service.ts` payout block conflicts → manual conflict resolution silently drops one author's `deleted_at` filter or transaction wrap → unprotected payout write reaches prod.
**Evidence:** Phase 2 §Related Code Files l.38 (`games.service.ts`) and Phase 3 Step 6 l.50 (`$transaction` multi-step writes, "đồng bộ DB-03") both target the same payout code; plan.md l.79 instructs them to run together.
**Suggested fix:** Make Phase 3's `games.service.ts` transaction/soft-delete work depend on Phase 2 completion (set Phase 3 `dependencies: [2]` for the shared-file subset, or carve money-file edits out of Phase 3 into Phase 2). Define file-ownership boundaries in the sequencing section: Phase 2 owns `games.service.ts` payout block; Phase 3 owns schema + non-money services.

---

## Summary — unresolved questions for the planner
1. Which is canonical, given `transfer_data` IS set at `stripe.service.ts:1175`? Finding 9 says PAY-02's premise needs re-verification before any deletion.
2. Will the soft-delete extension be global (287-site blast radius, Finding 4) or per-model allowlist? Money/auth tables must be excluded from the first rollout.
3. Has the GamePlayer duplicate-live-row data been deduped before the partial-index migration (Finding 5)? If not, the migration half-applies.
4. Confirm graceful-shutdown moves to Phase 1 (Finding 7) — otherwise every money/schema deploy is unsafe.
