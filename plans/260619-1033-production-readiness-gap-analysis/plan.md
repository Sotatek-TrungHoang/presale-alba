---
title: "Alba Production-Readiness Gap Analysis & Remediation"
description: "Gap analysis from current Alba source (NestJS backend + Expo mobile) to the production-grade go-live vision, with prioritized remediation phases, findings and man-day estimates."
status: pending
priority: P1
branch: "main"
tags: [production-readiness, audit, backend, mobile, security, payments]
blockedBy: []
blocks: []
created: "2026-06-19T03:47:41.975Z"
createdBy: "ck:plan"
source: skill
---

# Alba Production-Readiness Gap Analysis & Remediation

## Overview

Khách hàng đã build sẵn hệ thống Alba (golf social platform): backend NestJS (`alba-social-backend-main`) + mobile Expo/React Native (`alba-golf-rn-main`), và bàn giao để hoàn thiện + maintain tới mức **production-grade go-live**.

Plan này là kết quả **deep audit độc lập 7 chiều** (security, payments, feature completeness, reliability/infra, database, test, mobile+integration) trên source thật. Mỗi finding có dẫn chứng `file:line`. Plan chia remediation thành 7 phase theo thứ tự ưu tiên go-live.

**Verdict: KHÔNG đủ điều kiện go-live ở trạng thái hiện tại.** Core domain ~70-75% hoàn chỉnh, nhưng tồn tại các lỗ hổng **broken access control (IDOR)** và **money-integrity** cho phép mất tiền/lộ dữ liệu chỉ với 1 request; cùng với việc thiếu CI/CD, graceful shutdown, index DB, và gần như **không có test ở mobile**.

> Chi tiết từng chiều nằm ở `research/01..07-*.md`. Tổng hợp executive + master findings table ở `reports/00-executive-summary-and-findings.md`.

## Severity rollup (toàn hệ thống)

| Dimension | Critical | High | Medium | Low | Est (man-days) | Report |
|-----------|:-:|:-:|:-:|:-:|:-:|--------|
| Security & Auth (BE) | 4 | 6 | 7 | 4 | ~9.0 | `research/01-...` |
| Payments / Stripe (BE) | 3 | 4 | 4 | 2 | ~16.5 | `research/02-...` |
| Feature completeness (BE) | – | several | several | – | ~17.0 | `research/03-...` |
| Reliability / Infra (BE) | 4 | 5 | 5 | 2 | ~15.5 | `research/04-...` |
| Database / Prisma (BE) | 3 | 5 | 6 | 3 | ~14.0 | `research/05-...` |
| Test coverage (BE+RN) | 3 | 4+ | – | – | ~28.0 | `research/06-...` |
| Mobile + integration | 3 | 4 | 4 | 4 | ~13.5 | `research/07-...` |
| **Raw total** | **~20** | **~30+** | **~30+** | **~15+** | **~113.5** | |

**Estimate go-live (re-bucketed theo phase, gồm ~15% buffer PM/integration/QA): ~110–120 man-days.**
- 1 backend dev solo: ~5–6 tháng.
- Squad 3–5 dev (chạy song song theo critical path): ~10–13 tuần.

## Phases

| Phase | Name | Priority | Est (md) | Status |
|-------|------|:-:|:-:|--------|
| 1 | [P0 Security & Money Blockers](./phase-01-p0-security-money-blockers.md) | P1 | ~11 | Pending |
| 2 | [Payment System Completion](./phase-02-payment-system-completion.md) | P1 | ~8 | Pending |
| 3 | [Data Layer Hardening](./phase-03-data-layer-hardening.md) | P1 | ~12 | Pending |
| 4 | [Feature Completeness & Code Health](./phase-04-feature-completeness-code-health.md) | P2 | ~15 | Pending |
| 5 | [Reliability & Infrastructure](./phase-05-reliability-infrastructure.md) | P1 | ~15 | Pending |
| 6 | [Mobile Hardening & API Contract](./phase-06-mobile-hardening-api-contract.md) | P1 | ~13.5 | Pending |
| 7 | [Test Coverage & Quality Gate](./phase-07-test-coverage-quality-gate.md) | P2 | ~30 | Pending |

> Post red-team: Phase 1 ↑ (promote double-payout/graceful-shutdown/complaints/leaderboards), Phase 2 ↓ (double-payout chuyển sang P1, webhook handlers không rebuild), Phase 7 ↑ (mobile test từ-zero realistic). **Tổng full-scope ~120–140md.** Defer recommendations (D1–D5) có thể giảm ~25–35md cho bản go-live MVP — chờ user quyết.

## Go-live gate (Definition of Ready for production)

- [ ] Phase 1 hoàn tất: 0 Critical security/money finding còn open.
- [ ] Phase 2 hoàn tất: 1 luồng payment canonical duy nhất, hold/payout/refund tự động & transactional.
- [ ] Phase 3 hoàn tất: soft-delete enforced, index FK đầy đủ, list endpoint có pagination.
- [ ] Phase 5 hoàn tất: CI/CD gate (build+lint+test) chặn deploy; graceful shutdown; env validation at boot; observability.
- [ ] Phase 6 hoàn tất: contract mismatch = 0; auth 401/refresh + ErrorBoundary; không ship secret giả.
- [ ] Phase 7: coverage gate xanh cho money/auth/games; mobile có smoke + critical-flow tests.

## Sequencing & dependencies

```
Phase 1 (P0)  ──► Phase 2 (payments)  ──► Phase 7 (tests)
   │                  ▲
   ├──► Phase 3 (DB) ─┘ (payment race = DB-03 fix lives in P1/P3 seam)
   ├──► Phase 5 (infra)  ── independent, start early in parallel
   └──► Phase 6 (mobile) ── parallel, but contract fixes depend on P2 canonical-flow decision
Phase 4 (features/code-health) ── parallel after P1, lower risk
```

- **Phase 1 chặn tất cả** (không deploy gì khi Critical còn open).
- **Phase 2 ⟶ Phase 6**: quyết định "canonical payment flow" (`/games` vs `/v1/games`) ở Phase 2 mở khoá fix contract `EVENING`/`CONFIRMED` ở Phase 6 (xem PAY-02, MOB-01).
- **Phase 5 & Phase 7 song song**: CI (P5) là tiền đề để coverage gate (P7) có hiệu lực.
- **Phase 3** nên đi cùng Phase 2 (financial writes cần transaction + index).

## Cross-plan dependencies

Không có plan nào khác đang mở trong `./plans/` (chỉ có `reports/security-scan-2026-06-19.md` standalone — đã được reconcile vào audit security). Không có blockedBy/blocks.

## Open questions (cần khách hàng/PM trả lời — chặn estimate chính xác)

1. **Canonical payment flow**: `/games` (platform, no transfer_data) hay `/v1/games` (Connect)? Endpoint `processPlayerPayment` client-trusted còn live không? (PAY-01/02)
2. **Public endpoints có chủ đích?** `/leaderboards`, `/round/:id`, `/locations`, courses/profiles CRUD — feature thật hay scaffold thừa? (SEC-16, F03)
3. **Deploy target**: Railway xác nhận? Số instance (1 hay nhiều → quyết định Redis adapter cho Socket.IO/cache). (INF-05/06)
4. **EAS env**: các `EXPO_PUBLIC_*` prod đã set trên EAS dashboard chưa? (MOB release)
5. **Mobile timeslot EVENING**: thêm vào backend enum hay bỏ khỏi mobile? (MOB-01)
6. **Scope go-live**: launch backend+mobile cùng lúc hay backend trước?

---

## Red Team Review

### Session — 2026-06-19
**Reviewers:** 4 hostile lenses (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic), mỗi finding fact-check bằng `file:line`.
**Findings:** 38 raw → dedup 16 accepted + 5 defer-recommendations + 1 unresolved conflict.
Reports: `reports/from-code-reviewer-to-planner-red-team-*.md` (4 file).

Red-team xác nhận các Critical headline đúng, NHƯNG tìm ra **lỗi factual trong plan** và **mis-prioritization**. Đã tự verify lại các điểm tranh chấp trước khi sửa.

#### Corrections đã áp dụng (factual)
| # | Correction | Verified | Áp dụng |
|---|-----------|----------|---------|
| C1 | Sai path: `chat.service.ts` → thực tế `src/websockets/chat.service.ts` | `find` confirmed | Phase 1,3,4 |
| C2 | PAY-02 "custody fork": `createPaymentIntent` CÓ `transfer_data.destination` (`stripe.service.ts:1175`) — main flow nhất quán. Chỉ verify v1/games:298 có khác không, KHÔNG refactor custody mù | tôi verify | Phase 2 |
| C3 | PAY-01: KHÔNG "trigger payout trực tiếp"; route đã sau FirebaseAuthGuard+self-check. Bug thật = ghi `has_paid`/status không verify Stripe → hỏng paid-state gate payout | `games.service.ts:1312`, Assumption#1 | Phase 1 |
| C4 | PAY-06/08: handlers `handlePayoutPaid/Failed/Pending` ĐÃ tồn tại + dedup verified-clean. Bug thật = `handlePayoutFailed` không reset `payout_completed=false` + set đồng bộ `games.service.ts:1512`. KHÔNG rebuild webhook | `stripe.service.ts:2014/2175` | Phase 2 |
| C5 | MOB-01: `create-game.dto.ts:15` time_slot là TS union KHÔNG validator → EVENING không 400; Prisma enum đã có EVENING (`schema.prisma:627`). Bug thật = thiếu input validation + enum drift | tôi verify | Phase 6 + Phase 5 (ValidationPipe whitelist) |
| C6 | INF-03 downgrade: dump script đã có env checks + `read -p`; local CLI không request-reachable → rời tier "P0 1-request", giữ ops-safety; fix = dev-host **allowlist** không phải prod blocklist | `dump-prod-to-dev.sh:51-79` | Phase 1 (downgraded) |

#### Promotions → Phase 1 (đã accept)
| # | Finding | Severity | Evidence | Lý do |
|---|---------|----------|----------|-------|
| P1 | Double-payout race: `processGamePayout` check-then-act non-atomic + `payouts.create` không idempotency key | Critical | `games.service.ts:1441→1487`, `stripe.service.ts:1060` | Webhook idempotency KHÔNG bảo vệ outbound payout; admin-callable now |
| P2 | Graceful shutdown (INF-02) phải ở Phase 1, trước money/schema phases | Critical | `main.ts`, `prisma.service.ts` | Mọi deploy Phase 2/3 có thể half-apply/double-fire |
| P3 | Complaints PII IDOR (SEC-05) cùng class với SEC-01 | High→P1 | `complaints.service.ts:130-145` | Đừng để cửa sổ khai thác qua Phase 1 |
| P4 | Leaderboards unauth WRITE endpoint | High→P1 | `leaderboards.controller.ts:21/35/40` | Vi phạm rule "0 Critical/unauth-write trước deploy" |
| P5 | SEC-03 phải chặn cả **unauthenticated** socket join (yêu cầu `client.userId`), không chỉ participant check | Critical | `chat.gateway.ts:87-110` | Socket chưa auth vẫn join room |
| P6 | SEC-04 phải gồm `POST /users` + `users/signup-with-onboarding` + class-level guard trên UsersController (verify signup path thật trước khi guard) | Critical | `users.controller.ts:31,35,43` | Patch từng route sẽ tái phát lỗ |

#### Sequencing & migration safety (đã accept)
- **Soft-delete global extension ~287 call-sites** → KHÔNG parallelize với Phase 2 payout reads (`games.service.ts:1421/1477`); gate bằng file-ownership.
- Index trên `Message` (bảng lớn nhất) → migration phải `CONCURRENTLY`; partial unique index **không biểu diễn được trong Prisma schema** → raw SQL migration ⇒ điều chỉnh tiêu chí "no drift" của Phase 3.
- WS gateway CORS `origin:'*'` (`chat.gateway.ts:21`) đưa vào Phase 5 (citation drift: CORS thật ở `main.ts:44`).

#### Estimate correction
- **Mobile test (Phase 7): 12md → ~20–40md** (162 file / ~34k LOC từ zero + mock native Stripe/Firebase/Mapbox). Phase 7 nâng lên ~30md; **tổng go-live ~120–140md** (full scope).

#### Defer recommendations — GO-LIVE MVP vs POST-LAUNCH (cần user quyết, KHÔNG tự cắt)
> User đã chọn scope "full/enterprise". Đây là đề xuất resequencing cho go-live, không xoá scope. Cần xác nhận.
| # | Hạng mục | Đề xuất | Tiết kiệm cho launch |
|---|---------|---------|---------------------|
| D1 | Redis adapter / horizontal scaling (Phase 5 INF-05/06) | Defer nếu go-live = 1 instance (chờ Q3) | ~2–4md |
| D2 | God-service refactor (Phase 4 F-05) | Defer post-launch (regression risk cao trên money code) | ~4–6md |
| D3 | Phase 7 broad coverage + strict-mode | Risk-target money/auth + mobile critical flow cho launch | ~10–12md |
| D4 | Phase 3 broad FK sweep | Giữ DB-01/02/06, defer index-every-FK | ~4–5md |
| D5 | Stub implement-vs-remove (Phase 4) | Default **remove/guard**, không implement (chờ Q2) | varies |

#### Unresolved conflict (KHÔNG tự ý quyết)
- **PAY-02 custody**: main flow verified nhất quán (destination charges). Cần đọc `v1/games:298` path để xác nhận v1 có custody khác không → đưa vào task verify ở Phase 1/2 + Open Q1.

### Whole-Plan Consistency Sweep
- Đã reconcile path `chat.service.ts` → `src/websockets/chat.service.ts` trong các phase liên quan.
- PAY-01/02/06 reword nhất quán giữa plan.md, exec summary, Phase 1/2.
- MOB-01 reword nhất quán Phase 6 + thêm validation-gap (Phase 5).
- Double-payout race + graceful shutdown + complaints IDOR + leaderboards write đã promote vào Phase 1.
- Estimate tổng cập nhật ở rollup. **Không còn contradiction chưa giải quyết** ngoài PAY-02 (đã chuyển thành task verify + Open Q1, không phải mâu thuẫn ngầm).
