# Backend Payments & Financial Integrity — Production-Readiness Audit

**Target:** `alba-social-backend-main` (NestJS + Stripe Connect)
**Scope:** `src/stripe/`, `src/games/`, `src/v1/games/`, `src/complaints/`, `prisma/schema.prisma`, `src/main.ts`
**Date:** 2026-06-19
**Method:** Every finding cites a `path:line` actually opened. Absence of a control is reported with the grep run.

---

## Summary Table

| ID | Severity | Title | Estimate (md) |
|----|----------|-------|---------------|
| PAY-01 | **Critical** | `processPlayerPayment` trusts client-supplied amount + PI id; no Stripe verification → free "paid" status | 1.5 |
| PAY-02 | **Critical** | Two conflicting payment flows: v1 platform PI keeps funds on platform, but payout pays organizer from their (empty) connected balance | 3 |
| PAY-03 | **Critical** | No real "2-day hold" — payout is fully manual (admin endpoint), not scheduled; vision's auto-hold/payout not implemented | 2.5 |
| PAY-04 | **High** | No refund on game cancellation; no `cancelGame` flow at all → paid players stranded | 2 |
| PAY-05 | **High** | Refund amount mismatch: refunds `cost_per_player` but player charged `cost + 10% fee`; fee not refunded | 1 |
| PAY-06 | **High** | `createManualPayout` writes nothing to DB; no Transaction row, no reconciliation, race with `payout.paid` webhook | 1.5 |
| PAY-07 | **High** | CORS wide open (`enableCors()` no config) + no rate limiting on money endpoints | 0.5 |
| PAY-08 | **Medium** | `processGamePayout` not transactional: Stripe payout succeeds, then DB `payout_completed` update can fail → double-payout risk on retry | 1 |
| PAY-09 | **Medium** | Currency hardcoded `'gbp'` in payout/v1; payment intent currency from client DTO → possible mismatch | 0.5 |
| PAY-10 | **Medium** | No `idempotencyKey` on Stripe write calls (PI/refund/payout create) → duplicate charges/payouts on client retry | 1 |
| PAY-11 | **Medium** | Connect webhook lacks idempotency on `account.updated`-only? (it has staleness) but no `transactionEventLog` dedup for payout create path; relies on event-id dedup only | 0.5 |
| PAY-12 | **Low** | Webhook errors logged via `console.*` only; no structured money-event log / alerting; sensitive event data truncated to stdout | 0.5 |
| PAY-13 | **Low** | Onboarding gating present for Connect PI but v1 platform PI does not check recipient payouts_enabled | 0.5 |

**Total: ~16.5 man-days**

---

## Findings

### PAY-01 — [Critical] Client-trusted payment confirmation (free game entry)
**Evidence:** `src/games/games.controller.ts:188-205`, `src/games/games.service.ts:1312-1347`.
`POST :id/players/:playerId/payment` accepts `{ payment_intent_id, amount }` from the body and writes `has_paid: true, payment_amount: amount, stripe_payment_id: paymentIntentId` directly — **no call to Stripe to verify the PaymentIntent succeeded or that the amount/recipient match.** Only check is `user.id === playerId` (controller:196).
**Impact:** Any authenticated player can POST an arbitrary/forged `payment_intent_id` and `amount:0` and be marked paid. They then count toward `processGamePayout` (`games.service.ts:1465`), causing the platform to pay the organizer real money for a payment that never occurred. Direct money loss.
**Fix:** Delete this endpoint and rely solely on the webhook-driven `handlePaymentIntentSucceeded` path (which DOES verify via Stripe signature + `amount_received`, `stripe.service.ts:1485-1495`). If a manual endpoint is needed, `stripe.paymentIntents.retrieve(id)` and assert `status==='succeeded'`, `amount`, and metadata match.
**Estimate:** 1.5

### PAY-02 — [Critical] Conflicting payment flows: funds routed to platform but payout taken from organizer's empty balance
**Evidence:**
- v1 flow `src/v1/games/games.service.ts:298-310` → `createPlatformPaymentIntent` (`stripe.service.ts:1226-1283`) creates a PI with **no `transfer_data` / no `destination`** → funds settle on the **platform** account.
- Connect flow `src/games/games.service.ts:1799` → `createPaymentIntent` (`stripe.service.ts:1175-1177`) uses `transfer_data.destination = recipientStripeAccountId` → funds to **organizer**.
- Payout `src/games/games.service.ts:1498-1511` → `createManualPayout` (`stripe.service.ts:1060-1072`) issues `payouts.create` with `stripeAccount: connectedAccountId` → pays out from the **organizer's connected balance**.
**Impact:** If players pay via the v1 platform PI, the organizer's connected balance is never funded, yet `processGamePayout` tries to pay from it → payout fails (insufficient balance) OR, if organizer happens to have balance, platform pays out money it kept = loss. Two parallel flows with opposite fund custody is an unresolved architectural fork.
**Fix:** Pick ONE model. For "hold then payout" use **separate charges & transfers** (charge to platform, then `transfers.create` to organizer at payout time) OR **destination charge with `on_behalf_of` + manual payout schedule**. Remove the dead flow. Make payout source consistent with charge custody.
**Estimate:** 3

### PAY-03 — [Critical] "2-day hold + auto payout" not implemented; payout is manual-only
**Evidence:** Connected accounts created with `schedule.interval: 'manual'` (`stripe.service.ts:553-554`, `709-710`). Payout only triggers via admin endpoint `POST :id/payout` guarded by `user.admin_status` (`games.controller.ts:208-218`). Grep for any scheduler: `grep -rniE "hold|2.day|48.hour|@Cron|@Interval|ScheduleModule|setInterval|delay_days" src` → **no payout scheduler found**; only `@nestjs/schedule` referenced in `src/notifications/README.md:201` (not installed/used for payouts). `src/cron/` contains only notification runners.
**Impact:** The README vision ("funds HELD ~2 days post-game then auto payout to organizer") is **not in code**. Payout requires a human admin to call the endpoint per game. No dispute-window enforcement beyond a synchronous open-complaint check (`games.service.ts:1446-1450`). Operationally unscalable and the "hold" is implicit (manual schedule) not time-based.
**Fix:** Add `@nestjs/schedule` cron that, N days after `game.date` for `COMPLETED` games with no open complaints and `payout_completed=false`, calls the payout. Persist hold-until timestamp. Make idempotent (PAY-08).
**Estimate:** 2.5

### PAY-04 — [High] No refund on game cancellation
**Evidence:** Grep `grep -niE "cancel|refund" src/games/games.service.ts` → only join-guard mentions of `CANCELLED` (`368`, `1216`); **no `cancelGame` method and no refund issuance on cancel.** Refunds exist ONLY through the complaints path (`src/complaints/complaints.service.ts:245-273`).
**Impact:** If a game is cancelled after players paid, there is no automated (or any) refund path — players' funds are stranded; organizer/admin must manually file per-player refunds outside the app. Likely chargebacks.
**Fix:** Implement `cancelGame` that iterates paid, non-refunded players and issues `createRefund` (full amount incl. fee, see PAY-05), sets `refunded=true`, blocks payout.
**Estimate:** 2

### PAY-05 — [High] Refund underpays — fee not refunded
**Evidence:** Player charged `cost_per_player + round(cost*0.1)` (`src/v1/games/games.service.ts:298-300`). Complaint refund issues `amount: gamePlayer.game.cost_per_player` only (`src/complaints/complaints.service.ts:273-277`) and does not set `refund_application_fee`. `createRefund` defaults `refund_application_fee=false` (`stripe.service.ts:1318-1321`).
**Impact:** Refunded player loses the 10% application fee; platform keeps fee on a refunded transaction. Customer-fairness + potential dispute/regulatory issue.
**Fix:** Refund full charged amount (store the actual charged total on `GamePlayer.payment_amount` — webhook already does, `stripe.service.ts:1491`) and set `refund_application_fee:true` when appropriate. Refund by stored `payment_amount`, not `cost_per_player`.
**Estimate:** 1

### PAY-06 — [High] Payout creates no DB record; reconciliation gap + webhook race
**Evidence:** `createManualPayout` (`stripe.service.ts:1059-1078`) calls `payouts.create` and returns; comment "Optionally, record this payout event" — **nothing persisted.** The `payout.paid`/`payout.failed` webhooks (`stripe.service.ts:1894-2210`) then `findUnique` a Transaction by `stripe_payout_id`, don't find it, and create one. Meanwhile `processGamePayout` sets `payout_completed=true` immediately on API success (`games.service.ts:1514-1520`) regardless of eventual `payout.failed`.
**Impact:** Game marked paid-out even if the payout later **fails** (`payout.failed`); no automatic re-attempt and the game row is permanently `payout_completed=true`. No source-of-truth Transaction row at payout-initiation time → reconciliation depends entirely on webhook arrival.
**Fix:** Create a `PAYOUT` Transaction (status PENDING) inside `createManualPayout`, link `game_id`. On `payout.failed`, set `game.payout_completed=false` so it can retry. Persist payout id on the game.
**Estimate:** 1.5

### PAY-07 — [High] Open CORS + no rate limiting on money endpoints
**Evidence:** `src/main.ts:42` `app.enableCors();` (no origin allowlist). No `@nestjs/throttler` / guard found on `stripe.controller.ts` payout/refund/payment-intent routes (`stripe.controller.ts:261,288,332`).
**Impact:** Any origin can call authenticated money endpoints (CSRF-adjacent via stolen token), and there is no brute-force / abuse protection on PI creation, refund, payout.
**Fix:** Restrict CORS to known app origins; add ThrottlerGuard to financial routes.
**Estimate:** 0.5

### PAY-08 — [Medium] Payout flow not transactional → double-payout on retry
**Evidence:** `games.service.ts:1496-1520`: Stripe `payouts.create` runs, THEN a separate `prisma.game.update({payout_completed:true})`. No DB lock / `$transaction` around the gate check (`payout_completed` read at `1441`) and the payout call. Two concurrent admin calls (or a retry after the DB update fails post-Stripe-success) can both pass the `payout_completed=false` check and issue two payouts.
**Impact:** Duplicate payout = money loss.
**Fix:** Use a transactional/optimistic guard: `updateMany({where:{id, payout_completed:false}, data:{payout_completed:true}})` BEFORE calling Stripe; pass a Stripe idempotency key derived from `game_id` (see PAY-10). Roll back flag on Stripe failure.
**Estimate:** 1

### PAY-09 — [Medium] Currency hardcoding / mismatch risk
**Evidence:** Payout hardcodes `currency: 'gbp'` (`games.service.ts:1500`), v1 PI hardcodes `'gbp'` (`v1/games/games.service.ts:307`), but Connect `createPaymentIntent` takes currency from DTO (`stripe.service.ts:1166`). Payout amount derived from `cost_per_player` summed (`games.service.ts:1476-1482`).
**Impact:** If any PI is created in a non-GBP currency, payout currency won't match the held balance → payout failure or FX surprise.
**Fix:** Derive payout currency from the actual charges; centralize currency config.
**Estimate:** 0.5

### PAY-10 — [Medium] No Stripe idempotency keys on create calls
**Evidence:** `paymentIntents.create` (`stripe.service.ts:1194`, `1259`), `refunds.create` (`1326`), `payouts.create` (`1060`) — none pass `{ idempotencyKey }`.
**Impact:** Client/network retries can create duplicate PaymentIntents, refunds, or payouts.
**Fix:** Pass deterministic idempotency keys (e.g. `payout:{game_id}`, `refund:{game_player_id}`).
**Estimate:** 1

### PAY-11 — [Medium] Webhook dedup relies on single mechanism; verify payout-path coverage
**Evidence:** Charge/refund/payout handlers DO dedup via `transactionEventLog.findUnique({stripe_event_id})` inside `$transaction`/`executeWithRetry` (`stripe.service.ts:1362-1370`, `1911-1920`, `2078-2087`) — good. `account.updated` uses time-based staleness (`stripe.service.ts:833-841`) but NOT event-id dedup, so a replayed same-timestamp event with `<=` is skipped only if strictly older; equal timestamps with different payloads edge case.
**Impact:** Low-to-medium: account state could be re-processed; not money-moving but can flap `payouts_enabled`.
**Fix:** Add event-id dedup table for account events too.
**Estimate:** 0.5

### PAY-12 — [Low] Observability: money events only `console.*`
**Evidence:** All webhook/payout/refund logging via `console.log/error` (e.g. `stripe-webhook.controller.ts:100-109`, `stripe.service.ts:1074`). Sentry init present (`main.ts:8,11`) but money-event breadcrumbs not explicitly captured. Event data truncated to 1000 chars to stdout (`stripe-webhook.controller.ts:108`).
**Impact:** Hard to reconcile/alert on failed payouts/refunds in production.
**Fix:** Structured logger + Sentry capture for failed money events; alert on `payout.failed`.
**Estimate:** 0.5

### PAY-13 — [Low] v1 platform PI lacks recipient onboarding gate
**Evidence:** Connect `createPaymentIntent` checks `recipientUser.stripe_account?.stripe_connect_id` before charging (`stripe.service.ts:1137-1145`). v1 `createPlatformPaymentIntent` has no recipient/payout-enabled check (`stripe.service.ts:1226-1283`) — acceptable since funds go to platform, but couples to PAY-02; if organizer isn't onboarded, payout (PAY-03) will fail after money already collected.
**Impact:** Funds can be collected for games whose organizer can never receive payout.
**Fix:** Gate payment collection on organizer `payouts_enabled` (or at least `details_submitted`).
**Estimate:** 0.5

---

## Payment-Flow Trace (step → code → gap)

| Step | Code location | Status / Gap |
|------|---------------|--------------|
| Organizer onboards Connect account | `stripe.service.ts:255 createCustomAccount`, `553 schedule:manual` | OK; manual payout schedule (intentional hold mechanism) |
| Player approved | `games.service.ts` PlayerStatus checks, `v1/games:290` | OK |
| Player creates PaymentIntent | `v1/games:260` (platform PI, fee +10%) OR `games:1799`→`stripe:1097` (Connect PI) | **PAY-02** two divergent fund routes |
| Player pays → webhook | `stripe-webhook.controller.ts:71`→`stripe.service.ts:1352` | OK: sig verified, idempotent, sets `has_paid` from `amount_received` |
| Player marks paid (legacy) | `games.controller.ts:188`→`games.service.ts:1312` | **PAY-01** client-trusted, unverified — CRITICAL |
| Hold ~2 days | (none) grep: no scheduler | **PAY-03** not implemented; manual only |
| Dispute window | `games.service.ts:1446` open-complaint gate | Partial: synchronous gate, no timed window |
| Payout to organizer | `games.controller.ts:208`(admin)→`games.service.ts:1408`→`stripe.service.ts:1036` | **PAY-03/06/08** manual, no DB record, non-transactional |
| Payout result | webhook `stripe.service.ts:1894/2061` | `payout.failed` doesn't reopen `payout_completed` (**PAY-06**) |
| Refund (complaint) | `complaints.service.ts:245`→`stripe.service.ts:1285` | **PAY-05** underpays (no fee) |
| Refund (cancellation) | (none) | **PAY-04** not implemented |

---

## Task List

1. [Critical] Remove/secure `processPlayerPayment`; verify via Stripe retrieve (PAY-01).
2. [Critical] Resolve dual-flow fund custody; standardize on one Connect model (PAY-02).
3. [Critical] Implement scheduled hold + auto-payout cron with idempotent gate (PAY-03, PAY-08, PAY-10).
4. [High] Implement `cancelGame` with per-player full refunds (PAY-04, PAY-05).
5. [High] Persist payout Transaction; handle `payout.failed` reopen (PAY-06).
6. [High] Lock down CORS + add throttling on money routes (PAY-07).
7. [Medium] Derive currency from charges; remove hardcodes (PAY-09).
8. [Medium] Add Stripe idempotency keys to all create calls (PAY-10).
9. [Medium] Add event-id dedup for account webhooks (PAY-11).
10. [Low] Structured logging + Sentry money-event alerts (PAY-12); gate v1 collection on organizer onboarding (PAY-13).

**Total estimate: ~16.5 man-days**

---

## Open Questions

1. Which flow is canonical — v1 platform PI (`src/v1/games`) or the Connect PI (`src/games`)? Both are wired to live controllers; need product decision (drives PAY-02 scope).
2. Is `processPlayerPayment` (legacy client-trusted endpoint) still reachable by the production client, or dead code? If reachable → PAY-01 is exploitable today.
3. Intended hold duration and trigger: time-after-`game.date`? after `completeGame`? Confirms PAY-03 cron design.
4. Should application fee (10%) be refunded on cancellation vs. player-initiated complaint? (PAY-05 policy.)
5. [UNVERIFIED] Whether env has both `STRIPE_WEBHOOK_PLATFORM_SECRET` and `STRIPE_WEBHOOK_CONNECT_SECRET` set — code requires both (`stripe.service.ts:775-781`); STRIPE_WEBHOOKS.md only documents one platform secret. Check deploy env.
