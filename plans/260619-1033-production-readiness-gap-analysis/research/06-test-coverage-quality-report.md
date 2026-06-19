# 06 - Test Coverage & Quality Audit (Production-Readiness)

**Auditor dimension:** Test coverage, quality, lint/build gates.
**Date:** 2026-06-19
**Targets:**
- Backend: `alba-social-backend-main` (NestJS, Jest, `*.spec.ts`, e2e in `test/`)
- Mobile: `alba-golf-rn-main` (Expo RN, Jest + jest-expo, `__tests__/`)

**Note on execution:** `node_modules/` and `coverage/` are blocked by environment hook, so I could NOT run `jest`/`tsc`. All pass/fail and coverage-number claims are marked `[UNVERIFIED]` with the exact command to verify. All file/structure claims are verified by `ls`/`grep`/`find` against real files.

---

## 1. Inventory

| Project | Source files | Test files | Rough ratio | Notes |
|---|---|---|---|---|
| Backend | 211 `.ts` (non-test) in `src/` | 44 unit `*.spec.ts` + 4 e2e `*.e2e-spec.ts` + 1 `update-game.test.ts` (NOT matched by jest regex) = **48** | ~0.23 test:src (1 test per ~4.4 src files) | Decent breadth across HTTP modules |
| Mobile | 163 `.ts/.tsx` (non-test) | **1 real test** (`components/__tests__/ThemedText-test.tsx`) + 1 test-util helper (ignored) | ~0.006 | Effectively ZERO meaningful tests |

Verified by: `find src -name "*.ts" ! -name "*.spec.ts"` (backend 211); backend spec list (44 enumerated below); `find . -type d -name "__tests__"` in mobile → only `./__tests__/utils` (helper, ignored) and `./components/__tests__` (1 file).

### Backend per-module spec coverage (verified `find src/<mod> -name "*.spec.ts"`)
Has tests: admin (6), auth (2), complaints (2), conversations (2), courses (2), games (3 + 2 in `tests/`), groups (2), guards (1 admin.guard), image-processing (2), images (2), leaderboards (2), locations (2), messages (2), posts (2), prisma (1), profiles (2), relationships (2), shared (1), stripe (3), users (2), v1/games (2).

**ZERO spec files:** `attribution/` (249 LOC), `blocks/` (104), `cron/` (665), `firebase/` (31), `notifications/` (2296 LOC), `reports/` (152), `round/` (57), `websockets/` (802 LOC), `well-known/`.

### Mobile reality vs documentation (CRITICAL DISCREPANCY)
`TESTING.md` (6.5 KB) documents a full TDD suite: `__tests__/hooks/useComplaints.test.ts`, `__tests__/components/ui/ComplaintBanner.test.tsx`, `__tests__/api/games.test.ts`, `__tests__/components/ComplaintForm.test.tsx` — **NONE of these files exist** (verified `find` returns no `*.test.*` / `*.spec.*` anywhere outside node_modules). The only real test is:
```
components/__tests__/ThemedText-test.tsx  (174 bytes)
```
which is a **fake/no-op test** — `tree` is initialized to `null` and never assigned a render, then `expect(tree).toMatchSnapshot()` snapshots `null`. Verified by `cat`. The `coverage/` dir (clover.xml/lcov dated Jun 15) is therefore **stale/misleading** — it cannot reflect the current single empty test.

---

## 2. Coverage-Gap Matrix (critical areas)

| Critical area | Tested? | Evidence | Risk | Est (man-days) |
|---|---|---|---|---|
| **Backend payments — Stripe service** | YES, substantial | `src/stripe/stripe.service.spec.ts` = 3379 lines | Low-Med (behavior asserted; needs run to confirm green) | 0.5 (verify+gaps) |
| **Backend Stripe webhooks** | YES, controller-level, mocked sig | `stripe-webhook.controller.spec.ts` 188 ln: tests missing-sig, missing-rawBody, `constructWebhookEvent` failure, payment_intent.succeeded, app_fee.refund.updated, error mapping. `constructEvent` (real signature verify) is MOCKED | Med — signature verification path itself untested | 0.5 |
| **Backend game payout / state machine** | YES, high quality | `src/games/tests/game-payout-with-complaints.spec.ts` 767 ln: complaint-blocking (ConflictException), refund exclusion, no-Stripe-account, no-payments, Stripe error, not-found, not-completed, not-FULLY_PAID, idempotent already-processed. Genuine behavior assertions | Low | 0.5 |
| **Backend auth / guards** | PARTIAL | `auth.service.spec.ts`, `auth.controller.spec.ts`, `guards/admin.guard.spec.ts`. JWT/Firebase auth guard (non-admin) — no dedicated spec found | Med — main auth guard path thin | 1 |
| **Backend websockets (real-time chat)** | NO | `websockets/` 802 LOC, 0 spec | High — untested real-time/auth handshake | 2 |
| **Backend notifications (FCM/push)** | NO | `notifications/` 2296 LOC, 0 spec | High — largest untested module | 2.5 |
| **Backend cron (scheduled jobs)** | NO | `cron/` 665 LOC, 0 spec | Med — silent job failures | 1.5 |
| **Backend blocks / reports / attribution / round** | NO | 104/152/249/57 LOC, 0 spec each | Med (moderation/safety logic untested) | 2 |
| **Mobile — ALL (payments UI, complaints, games, auth, API client)** | NO | Only 1 empty snapshot test; documented tests do not exist | **Critical** — entire app untested | 12 |

---

## 3. Findings

### TEST-01 [CRITICAL] Mobile app has effectively ZERO test coverage
Only `ThemedText-test.tsx` exists and it asserts nothing (`expect(null).toMatchSnapshot()`). 163 source files, including payment/complaints/game-join flows, are untested. `coverage/` artifacts are stale and do not reflect current state. Not safe to ship money-handling mobile flows.
Evidence: `find` (no test files), `cat components/__tests__/ThemedText-test.tsx`.

### TEST-02 [CRITICAL] TESTING.md documents a test suite that does not exist
`TESTING.md` describes 4+ test files (hooks/components/api/integration) as implemented with checkmarks. None exist on disk. This is misleading documentation that masks the zero-coverage reality — a reviewer trusting docs would assume the complaints feature is tested.
Evidence: `head -60 TESTING.md` vs `find . -name "*.test.*"` (empty).

### TEST-03 [CRITICAL] No CI/CD pipeline in either project — tests never run automatically
No `.github/`, no `*.yml`/`*.yaml` workflow files in either repo. Nothing runs `jest`, `tsc`, or lint on push/PR. All quality gates are manual/opt-in.
Evidence: `ls -la .github` (absent both), `find ... -name "*.yml"` (none).

### TEST-04 [HIGH] Mobile 70% coverage threshold is unmet and unenforced
`package.json` sets `coverageThreshold.global` = 70% (branches/functions/lines/statements) but `collectCoverageFrom` only scopes `components/`, `hooks/`, `utils/` — and with 1 empty test, a real `jest --coverage` run would report ~0% and FAIL the threshold. The threshold only bites when someone runs `test:coverage` locally; with no CI it is never enforced.
`[UNVERIFIED]` actual %: run `npm run test:coverage` in `alba-golf-rn-main` (needs node_modules).
Evidence: `package.json:40-54`.

### TEST-05 [HIGH] Backend has NO coverage threshold configured
`package.json` jest block has `testRegex`, `testEnvironment` but **no `coverageThreshold`** and no `collectCoverageFrom`. Coverage is never gated; regressions in test coverage go unnoticed. `update-game.test.ts` (171 ln) won't even run — jest `testRegex` is `.*\.spec\.ts$`, so `*.test.ts` is silently excluded.
Evidence: `grep -n testRegex package.json` (`.*\\.spec\\.ts$`), no `coverageThreshold` match.

### TEST-06 [HIGH] Backend tsconfig is non-strict — weak type safety
`tsconfig.json:15-17`: `strictNullChecks: false`, `noImplicitAny: false`, `strictBindCallApply: false`. Null-deref and implicit-any bugs that tests might otherwise surface are not caught by the compiler. (Mobile `tsconfig.json:4` correctly has `strict: true`.)
Evidence: `grep strict tsconfig.json` both projects.

### TEST-07 [MEDIUM] Backend e2e tests require live infra; likely not runnable in CI as-is
`test/app.e2e-spec.ts` boots full `AppModule` (overrides Stripe/Firebase only) → needs DB connection + env. `user-onboarding.e2e-spec.ts` (9.8 KB), `locations`, `courses-by-location` similarly hit the real module graph. No test DB setup/teardown or `.env.test` harness observed. `[UNVERIFIED]` pass/fail: `npm run test:e2e` (needs DB + node_modules).
Evidence: `cat test/app.e2e-spec.ts`, `test/jest-e2e.json`.

### TEST-08 [MEDIUM] Stripe webhook signature verification path is mocked out
Webhook controller tests stub `constructWebhookEvent` — the actual Stripe signature validation (the security-critical part preventing forged webhooks) is never exercised by a test with a real/known-bad signature.
Evidence: `grep constructEvent src/stripe/stripe-webhook.controller.spec.ts`.

### TEST-09 [LOW] No skipped/`.todo`/`xit`/`fit` tests in backend
Clean — no disabled or focused tests that would silently drop coverage or pin to one test.
Evidence: `grep -rn ".skip|.todo|xit(|fit(" src test` → empty.

---

## 4. Lint / Build Status

| Check | Backend | Mobile |
|---|---|---|
| Lint config | `.eslintrc.js` present; `lint` = `eslint "{src,apps,libs,test}/**/*.ts" --fix` (`@typescript-eslint` v8). `--fix` in the lint script auto-mutates code rather than just reporting | `eslint.config.js` NOT found at root; `lint` = `expo lint` (uses Expo's bundled flat config). No project eslint config file → relies on Expo defaults |
| Lint passes? | `[UNVERIFIED]` — run `npm run lint` (needs node_modules) | `[UNVERIFIED]` — run `npm run lint` |
| tsconfig strict | NO (`strictNullChecks/noImplicitAny/strictBindCallApply` = false) — TEST-06 | YES (`strict: true`) |
| Build / type-check | `[UNVERIFIED]` — `npx tsc --noEmit` or `npx nest build` | `[UNVERIFIED]` — `npx tsc --noEmit` |
| CI runs any of the above? | NO (TEST-03) | NO (TEST-03) |

Exact verify commands (run from each repo root after `npm ci`):
- Backend: `npm run lint && npx tsc --noEmit && npm test && npm run test:e2e`
- Mobile: `npm run lint && npx tsc --noEmit && npm run test:coverage`

---

## 5. Task List (to reach production-readiness)

1. [Critical] Build a real mobile test suite: payment/checkout flows, complaints submit, game join/leave, auth/session, API client error paths. Delete/rewrite the no-op `ThemedText-test.tsx`. (12 d)
2. [Critical] Reconcile or delete `TESTING.md` — implement the documented tests or remove false claims. (folded into #1)
3. [Critical] Add CI (GitHub Actions) for BOTH repos: `lint` + `tsc --noEmit` + `jest` (+ e2e where infra allows) on PR; block merge on failure. (1.5 d)
4. [High] Backend: cover untested critical modules — notifications, websockets, cron, blocks/reports/round/attribution. (8 d total)
5. [High] Backend: add `coverageThreshold` + `collectCoverageFrom` to jest config; fix `update-game.test.ts` naming so it actually runs. (0.5 d)
6. [High] Backend: enable `strict` (incrementally: `strictNullChecks` first) and fix fallout. (3 d)
7. [Med] Backend: add a test that exercises real Stripe webhook signature verify (valid + tampered). (0.5 d)
8. [Med] Backend e2e: add test-DB harness (`.env.test`, setup/teardown) so e2e runs deterministically in CI. (1.5 d)
9. [Med] Verify the existing 44 backend specs actually pass (`npm test`) and fix any red. (1 d)

---

## 6. Total Estimate

| Area | Man-days |
|---|---|
| Mobile suite from scratch (#1/#2) | 12 |
| CI for both repos (#3) | 1.5 |
| Backend untested critical modules (#4) | 8 |
| Backend coverage gating + test-name fix (#5) | 0.5 |
| Backend strict mode (#6) | 3 |
| Stripe webhook sig test (#7) | 0.5 |
| Backend e2e harness (#8) | 1.5 |
| Verify/repair existing backend specs (#9) | 1 |
| **TOTAL** | **~28 man-days** |

---

## 7. Open Questions

1. Was the mobile `coverage/` dir generated against a tree that previously had the TESTING.md tests (since deleted/lost), or fabricated? Affects trust in prior QA claims.
2. Is there an out-of-repo CI (GitLab/Jenkins/Bitbucket pipeline) not present in these snapshots? Assumed none.
3. Do the 44 backend specs currently pass green? Cannot run (node_modules blocked) — needs `npm test` to confirm before trusting the ~0.23 ratio as real coverage.
4. Is `update-game.test.ts` intended to run? Its `.test.ts` name is excluded by `testRegex .*\.spec\.ts$` — dead test or naming bug?
