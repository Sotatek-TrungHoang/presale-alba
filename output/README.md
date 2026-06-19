# Alba — Golf Social Platform
## Production-Readiness Hardening & Go-Live Remediation — Proposal

**Prepared by:** SotaTek · **Prepared for:** Alba (Client) · **Date:** 19 Jun 2026 · **Version:** 1.1

---

## 1. Executive Summary

Alba is a mobile-first golf social platform (iOS + Android): golfers post and discover
games/rounds, match with players who fit their preferences, coordinate over real-time chat
and notifications, and split the cost of play through in-app payments (Stripe Connect).

The product is **already built** — a NestJS / Prisma / PostgreSQL backend and an Expo /
React Native app, both authenticating the same user through Firebase. We ran an
**independent 7-dimension deep audit** of the real source (security, payments, feature
completeness, reliability/infrastructure, database, testing, mobile + integration). Every
finding is backed by a `file:line` reference.

> **Verdict: the system is not yet ready for production go-live.** The core domain is
> ~70–75% complete and the payments/games modules are well-tested, but there are
> **money-integrity** and **broken-access-control (IDOR)** holes exploitable in a single
> request, plus missing operational foundations (no CI/CD, no graceful shutdown, missing DB
> indexes) and **near-zero test coverage on the mobile app**.

**Headline:** ~20 Critical and ~30+ High findings across the system.

This proposal packages the remediation into a **parallel-squad delivery of ~8 weeks
(2 months)** — compressed from the original sequential 4-month plan by running independent
workstreams concurrently.

---

## 2. What We Audited — and What Is Already Solid

**Method:** 7 context-isolated sub-agents audited the real code; findings cross-checked by a
4-lens red-team (security adversary, failure-mode analyst, assumption destroyer, scope critic)
and verified at `file:line` before inclusion.

**Verified CLEAN (no rework needed) — builds confidence in the existing foundation:**

- No hardcoded server secrets / private keys / DB credentials; secrets come from `process.env`.
- Stripe **webhook signature verification + idempotency** (event log inside a DB transaction).
- Firebase ID-token guard and admin guard **fail-closed** correctly.
- Money stored as **integer pence** — no float-for-money bug.
- Raw SQL is **parameterized** (no injection surface).
- Cron architecture (one-shot runner, fail-loud, Sentry flush) is well designed.
- ~25 mobile↔backend endpoints already align correctly.

The engagement **hardens and completes** the existing system — no rewrite.

---

## 3. Critical Findings (Go-Live Blockers)

| ID | Area | Finding | Evidence |
|----|------|---------|----------|
| SEC-01/02 | Security | IDOR — read any conversation's messages / list conversations by URL userId | `conversations.controller.ts:37,43` |
| SEC-03 | Security | WebSocket `joinRoom` accepts unauthenticated sockets, no membership check (eavesdrop/inject) | `chat.gateway.ts:87` |
| SEC-04 | Security | `/users/*` CRUD unguarded; `notifications/send-all` not admin-gated | `users.controller.ts:31-43` |
| SEC-05 | Security | Complaints PII readable by any authenticated user | `complaints.service.ts:130` |
| F-03 | Security | Leaderboard **write** endpoints unauthenticated | `leaderboards.controller.ts:21/35/40` |
| PAY-01 | Payments | Player payment trusts client `amount`/`intent_id` — marks paid without verifying Stripe | `games.service.ts:1312` |
| PAY-08 | Payments | **Double-payout race** — non-atomic check-then-act, no idempotency key on payout | `games.service.ts:1441`, `stripe.service.ts:1060` |
| PAY-03 | Payments | "2-day hold + auto-payout" not implemented (manual schedule, no cron) | `stripe.service.ts:553` |
| DB-01/02 | Database | No index on `Message.conversation_id` + unbounded fetch; soft-deleted rows leak to client | `chat.service.ts:305` |
| DB-03 | Database | Payment-status read-derive-write not transactional → lost update | `games.service.ts:1339` |
| INF-01/02 | Infra | No CI/CD gate; no graceful shutdown (Prisma never `$disconnect`s) → redeploys abort requests | `.github/` absent, `main.ts` |
| INF-04 | Infra | No env validation → fails late at runtime | `app.module.ts:45` |
| TEST-01 | Testing | Mobile app has ~0 real tests (163 source files, 1 no-op test) | `__tests__/` |
| MOB-01/02/03 | Mobile | `EVENING` time-slot 400s on create; no 401/token-refresh; no ErrorBoundary (white-screen on crash) | mobile `api/`, `app/` root |

Full master table and per-dimension detail: `plans/260619-1033-production-readiness-gap-analysis/`.

---

## 4. Remediation Scope (Workstreams)

| | Workstream | What it delivers |
|---|---|---|
| **A** | Security & Access Control | Close all IDOR; guard user/admin/leaderboard routes; authenticate WebSocket joins; fix reflected XSS on `/go`. |
| **B** | Payments & Payouts | One canonical flow; server-side Stripe verification; 2-day hold + automated payout; refund-on-cancel; atomic, idempotent, double-payout-safe. |
| **C** | Data Layer | Enforce soft-delete globally; FK/hot-path indexes (concurrent migrations); fix unique-with-`deleted_at`; pagination; transactional writes. |
| **D** | Mobile App | Fix contract drift (`EVENING`, `CONFIRMED`); 401 + token refresh; ErrorBoundary; remove fake Stripe key; EAS env wiring. |
| **E** | Reliability & Infrastructure | CI/CD gate; graceful shutdown; env validation; hardened Dockerfile; Helmet/throttler/CORS; Redis adapter for multi-instance scale. |
| **F** | Compliance, Legal & Comms | GDPR export/erasure (6-yr ledger retention carve-out); store-mandatory privacy/consent; transactional email (SendGrid). |
| **G** | Performance & Scale (10k+) | Remove N+1; cache suggested/nearby; `pg_trgm` search index; rate-limit; WebSocket scale; moderation enforcement; mobile react-query. |
| **H** | Quality & Testing | Coverage gate for money/auth/games; mobile smoke + critical-flow tests (built from near-zero). |

---

## 5. Delivery Plan — ~8 Weeks (2 Months), Parallel Squad

Phase 1 (P0 blockers) gates everything — nothing deploys while a Critical is open. Once
blockers clear, the remaining workstreams run **concurrently** across four tracks, with
testing threaded throughout. This is what compresses the original sequential 4-month plan
into 2 months.

**Tracks (run in parallel after Sprint 1):**

- **T1 — Security & Payments** (senior backend): Phase 1 → 2
- **T2 — Data, Performance & Compliance** (backend): Phase 3 → 9/10 → 11
- **T3 — Infra & DevOps** (backend/DevOps): Phase 5 + CI + ops correctness
- **T4 — Mobile** (mobile): Phase 6 + mobile compliance/test slices
- **QA** (woven in, heavy in weeks 5–8): Phase 7 targeted coverage

| Sprint | Weeks | Focus | Key deliverables |
|--------|-------|-------|------------------|
| 1 | 1–2 | **P0 blockers + CI** | All IDOR/access-control closed, sockets authenticated, client-trusted payment fixed, double-payout made atomic, graceful shutdown, CI/CD gate stood up. |
| 2 | 3–4 | **Payments + Data + Infra** | Canonical flow, 2-day hold + auto-payout, refund-on-cancel; soft-delete + indexes + pagination; env validation, hardened Dockerfile, Helmet/throttler, Redis scale. Mobile contract + auth resilience in parallel. |
| 3 | 5–6 | **Compliance + Scale + Completeness** | GDPR export/erasure + consent + SendGrid email; N+1 removal, search index, moderation enforcement; live-stub completion; timezone/CVE/`v1` correctness; test build-out. |
| 4 | 7–8 | **Quality Gate, UAT & Go-Live** | Coverage gate green for money/auth/games; mobile smoke + critical-flow tests; staging deploy, UAT, fixes, production deploy + handover docs. |

> **Aggressive option (~6 weeks / 1.5 months):** achievable if Workstreams F/G (compliance,
> growth-scale) are deferred to a fast-follow and the launch targets the go-live blockers only
> (A–E + targeted H). Recommended only if store-publish and UK/EU compliance can lag the
> backend launch.

---

## 6. Estimate & Team

Total engineering effort ≈ **150–186 man-days** (recommended scope = full hardening,
Phases 1–11, growth-ready 10k+, UK/EU compliance, production-grade stubs, Redis — excluding
the deferred god-service refactor and broad/strict test coverage). Delivered by a **dedicated
parallel squad over 2 months ≈ ~11.5 man-months all-in**.

| Role | Allocation | M/M |
|------|-----------|----:|
| Project Manager | part-time | 1.0 |
| BA & UI/UX Designer | front-loaded | 0.75 |
| Backend Engineer ×3 | full | 6.0 |
| Mobile Engineer | full | 1.5 |
| QC Engineer | weeks 3–8 | 1.5 |
| DevOps Engineer | part-time | 0.75 |
| **Total** | | **~11.5** |

> Same total effort/cost as a single-track 4-month plan — calendar time is halved by running
> three backend tracks + mobile in parallel. Detailed cost & milestones in the client `.docx`.

---

## 7. Deliverables

- Hardened backend + mobile source (merged to `main`, passing CI/CD quality gate)
- Go-live gate sign-off (0 open Critical findings; per-phase checklist evidence)
- Automated payment lifecycle (canonical flow: hold / payout / refund — atomic, idempotent)
- Database migrations (indexes, soft-delete enforcement, constraint fixes — concurrent, reversible)
- CI/CD + infrastructure config (pipeline, hardened Dockerfile, env validation, Redis scale)
- Test suites & coverage report (money/auth/games gate + mobile smoke / critical-flow)
- Compliance package (GDPR export/erasure, consent flows, transactional email)
- Deployment & handover guide (runbook, environment matrix, UAT report)

---

## 8. Out of Scope / Deferred Post-Launch

- **God-service refactor** (games ~2,200 LOC) — high regression risk on money code (~14–18 md add-on).
- **Broad / strict-mode test coverage** beyond money/auth/critical flows.
- **Accessibility (a11y) + internationalisation (i18n)** — separate backlog (~11–17 md).
- **No new product features** — hardening/completion of existing scope only.
- **Elasticsearch / native AML** — `pg_trgm` is sufficient; AML handled by Stripe.

---

## 9. Assumptions & Open Questions (confirm before final figures, ±~5 md)

1. **Canonical payment flow** — `/games` vs `/v1/games`? Is the client-trusted endpoint still live? (PAY-01/02)
2. **Public endpoints** (leaderboards, round, locations, courses/profiles CRUD) — real features or leftover scaffold?
3. **Deploy target** Railway? Instance count (drives Redis adapter decision).
4. **EAS** — are production `EXPO_PUBLIC_*` vars set on the dashboard?
5. **Time-slot `EVENING`** — add to backend enum, or remove from mobile?
6. **Go-live sequencing** — backend + mobile together, or backend first?
7. **Confirmed assumptions** (final sign-off): 6-yr financial retention, SendGrid email, `pg_trgm` search, rate-limit defaults.

---

## 10. Go-Live Gate (Definition of Ready)

- [ ] 0 open Critical security/money findings.
- [ ] One canonical payment flow with automated, atomic hold/payout/refund.
- [ ] Soft-delete enforced, indexes complete, list endpoints paginated.
- [ ] CI/CD gate (build + lint + test) blocks deploy; graceful shutdown; env validation at boot.
- [ ] Mobile contract mismatch = 0; 401/refresh + ErrorBoundary; no fake secrets shipped.
- [ ] Coverage gate green for money/auth/games; mobile smoke + critical-flow tests pass.

---

*Source audit & remediation plan: `plans/260619-1033-production-readiness-gap-analysis/`
(plan + 11 phase files + 7 research reports + executive summary + red-team reviews).*
