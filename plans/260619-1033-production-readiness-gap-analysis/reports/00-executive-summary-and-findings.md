# Alba — Production-Readiness: Executive Summary & Master Findings

**Date:** 2026-06-19
**Scope:** `alba-social-backend-main` (NestJS) + `alba-golf-rn-main` (Expo/RN), DB (Prisma/Postgres), DevOps.
**Method:** 7 sub-agent độc lập ngữ cảnh, audit code thật, mọi finding có dẫn chứng `file:line`.
**Vision/baseline:** `alba-social-backend-main/README.md` (customer's go-live vision).
**Plan:** `../plan.md` · **Per-dimension detail:** `../research/01..07-*.md`

---

## 1. Verdict

**Hệ thống CHƯA đủ điều kiện go-live production.** Core domain (golf social: games, courses, posts, chat, notifications, leaderboards…) đã hiện thực ~**70-75%** và phần payments/games có test tốt. Nhưng tồn tại lỗ hổng nghiêm trọng cho phép **mất tiền / lộ dữ liệu chỉ với 1 request**, cùng thiếu hụt nền tảng vận hành (CI/CD, graceful shutdown, index DB) và **gần như 0 test ở mobile**.

**~20 Critical, ~30+ High** trên toàn hệ thống.

---

## 2. Severity rollup & estimate

| Dimension | Crit | High | Med | Low | Est (md) | Report |
|-----------|:-:|:-:|:-:|:-:|:-:|--------|
| Security & Auth (BE) | 4 | 6 | 7 | 4 | ~9.0 | `research/01` |
| Payments / Stripe (BE) | 3 | 4 | 4 | 2 | ~16.5 | `research/02` |
| Feature completeness (BE) | – | ~5 | ~6 | – | ~17.0 | `research/03` |
| Reliability / Infra (BE) | 4 | 5 | 5 | 2 | ~15.5 | `research/04` |
| Database / Prisma (BE) | 3 | 5 | 6 | 3 | ~14.0 | `research/05` |
| Test coverage (BE+RN) | 3 | 4+ | – | – | ~28.0 | `research/06` |
| Mobile + integration | 3 | 4 | 4 | 4 | ~13.5 | `research/07` |
| **Raw total** | **~20** | **~30+** | **~30+** | **~15+** | **~113.5** | |

**Estimate go-live (re-bucketed theo 7 phase, gồm ~15% buffer): ~110–120 man-days.**
- 1 backend dev: ~5–6 tháng · Squad 3–5 dev song song: ~10–13 tuần.

---

## 3. Master findings — Critical (go-live blockers)

| ID | Dim | Finding | Evidence | Est |
|----|-----|---------|----------|:-:|
| PAY-01 | Pay | `processPlayerPayment` tin `amount`/`intent_id` client, không verify Stripe → mark-paid free + trigger payout thật | `games.service.ts:1312`, `games.controller.ts:188` | 1.5 |
| PAY-02 | Pay | 2 luồng payment mâu thuẫn: v1 không `transfer_data` nhưng payout rút từ connected balance chưa fund | `v1/games:298`, `stripe.service.ts:1060` | 3 |
| PAY-03 | Pay | "2-day hold + auto-payout" chưa implement (`schedule: manual`, không cron) | `stripe.service.ts:553` | 3 |
| SEC-01 | Sec | IDOR đọc message của bất kỳ conversation | `conversations.controller.ts:43`→`chat.service.ts:304` | 1 |
| SEC-02 | Sec | IDOR list conversation theo userId từ URL | `conversations.controller.ts:37` | 0.5 |
| SEC-03 | Sec | WS `joinRoom` không check membership (eavesdrop/inject) | `chat.gateway.ts:87` | 1 |
| SEC-04 | Sec | `/users/*` CRUD không guard; `notifications/send-all` không admin | `users.controller.ts:35-194`, `notifications.controller.ts:92-115` | 1 |
| DB-01 | DB | Không index `Message.conversation_id` + fetch unbounded → full scan | `chat.service.ts:305` | 1 |
| DB-02 | DB | Soft-deleted message/conversation rò rỉ (không filter `deleted_at`) | `chat.service.ts:251,305,159,216,323` | 2 |
| DB-03 | DB | Payment-status read-derive-write không transactional → lost update | `games.service.ts:1339-1377` | 1 |
| INF-01 | Infra | Không CI/CD; test/lint không gate deploy | `.github/` absent | 1.5 |
| INF-02 | Infra | Không graceful shutdown; Prisma không `$disconnect` → redeploy abort + leak conn | `main.ts`, `prisma.service.ts` | 1 |
| INF-03 | Infra | `dump-prod-to-dev.sh` `DROP TABLE CASCADE` không guard host/env | `dump-prod-to-dev.sh:175` | 0.25 |
| INF-04 | Infra | Không env validation → fail muộn runtime | `app.module.ts:45` | 0.5 |
| INF-05/06 | Infra | Single-instance lock-in (Socket.IO + cache in-memory) → không scale ngang | `chat.gateway.ts`, `app.module.ts:59` | 3 |
| TEST-01 | Test | Mobile ~0 test thật (1 test no-op) | `alba-golf-rn-main/__tests__/` | 12 |
| TEST-02 | Test | `TESTING.md` mô tả bộ test không tồn tại | `TESTING.md` | 0.5 |
| TEST-03 | Test | Không CI ở cả 2 repo | `.github/` absent | (= INF-01) |
| MOB-01 | Mob | `EVENING` timeslot POST `/games` → 400, vỡ tạo round | `select-time-slot.tsx:31` vs `CreateGameDto` | 0.5 |
| MOB-02 | Mob | Không 401 handling / token refresh → token stale fail | `api/config.ts`, `providers/Auth.tsx` | 1.5 |
| MOB-03 | Mob | Không ErrorBoundary → render throw = white-screen | app/ root | 0.5 |

---

## 4. High-severity (tóm tắt, chi tiết ở research/)

- **Sec:** complaints PII readable by any auth user (`complaints.controller.ts:34`); inline-admin fragility; S3 presign content-type; public user-data reads.
- **Pay:** không `cancelGame`/refund-on-cancel (kẹt tiền); payout không persist/không reopen on fail; payout không transactional (double-payout on retry).
- **Feature:** course CRUD stub live (`courses.service.ts:180/891/895`); profiles CRUD stub + route-ordering bug; leaderboards CRUD stub không guard; chat getMessages không pagination; god services (games 2200 LOC).
- **Infra:** Dockerfile chưa multi-stage/non-root/healthcheck; CORS mở; Swagger không gate; thiếu throttler+helmet.
- **DB:** thiếu FK index diện rộng (6/44 model có index); unique constraint bỏ qua `deleted_at` → re-create lỗi (bug active với GamePlayer).
- **Test:** mobile 70% không enforce; backend không có coverage threshold; tsconfig backend non-strict; nhiều module backend 0 spec.
- **Mob:** Stripe key giả hardcode fallback; `CONFIRMED` vs `APPROVED/REJECTED` drift.

---

## 5. Đã verify CLEAN (không cần làm lại)

- ✅ Không hardcode server secret/private key/DB cred; secrets từ `process.env`; `.gitignore` đúng.
- ✅ Stripe webhook signature verification + idempotency (`transactionEventLog.stripe_event_id` trong `$transaction`).
- ✅ Firebase ID-token guard + admin guard fail-closed đúng.
- ✅ Tiền lưu `Int` (pence) — không có Float-for-money bug.
- ✅ Raw SQL parameterized (tagged template); không `$queryRawUnsafe`/`eval`/`child_process`.
- ✅ Kiến trúc cron one-shot (1 Railway service/job, fail loudly, flush Sentry) thiết kế tốt.
- ✅ ~25 endpoint mobile↔backend align đúng (games CRUD, stripe onboarding, users/me, conversations, location).

> Lưu ý 1 finding từ scan trước cần nhớ: **reflected XSS `/go`** (`attribution/go.controller.ts:48-94`) — gộp vào Phase 1/5 hardening.

---

## 6. Lộ trình & gate go-live

Thứ tự: **Phase 1 (P0 blockers) → song song [Phase 2 payments, Phase 3 DB, Phase 5 infra, Phase 6 mobile, Phase 4 features] → Phase 7 tests xuyên suốt.**

Go-live khi: 0 Critical open · 1 payment flow canonical với hold/payout/refund tự động & atomic · soft-delete enforced + index đủ · CI gate + graceful shutdown + env validation · contract mobile = 0 mismatch · test xanh cho money/auth/games.

---

## 7. Open questions (chặn estimate chính xác — cần khách hàng/PM)

1. Canonical payment flow `/games` vs `/v1/games`? Endpoint `processPlayerPayment` client-trusted còn live? (PAY-01/02)
2. Public endpoints (`/leaderboards`, `/round/:id`, `/locations`, courses/profiles CRUD) là feature hay scaffold thừa? (SEC-16, F-01/02/03)
3. Deploy target Railway? Số instance (quyết định Redis adapter). (INF-05/06)
4. `EXPO_PUBLIC_*` prod đã set trên EAS? (MOB release)
5. Timeslot `EVENING`: thêm backend enum hay bỏ mobile? (MOB-01)
6. Go-live backend+mobile cùng lúc hay backend trước?

> Các mục [UNVERIFIED] trong research (coverage % thực, pool config DB, số instance, prod entrypoint) cần xác nhận lúc thực thi — agent không chạy được test/runtime (node_modules bị chặn bởi môi trường).
