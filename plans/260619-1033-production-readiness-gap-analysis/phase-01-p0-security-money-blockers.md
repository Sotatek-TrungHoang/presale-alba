---
phase: 1
title: "P0 Security & Money Blockers"
status: pending
priority: P1
effort: "~11d"
dependencies: []
---

# Phase 1: P0 Security & Money Blockers

## Overview
Đóng toàn bộ Critical có thể gây **mất tiền, lộ dữ liệu, hoặc phá DB** chỉ với một request. Đây là điều kiện tiên quyết — không deploy bất cứ thứ gì khi phase này còn open. Nguồn: `research/01,02,04,05`.

## Requirements
- Functional: mọi route trả dữ liệu/ thao tác trên tài nguyên người dùng phải kiểm tra ownership; thanh toán phải được Stripe xác minh; script vận hành không được xoá nhầm prod.
- Non-functional: 0 Critical finding open; có regression test cho từng fix.

> **Path note (red-team verified):** mọi tham chiếu `chat.service.ts` = `src/websockets/chat.service.ts` (KHÔNG phải `src/chat/`).

## Findings xử lý trong phase này
| ID | Sev | Vấn đề | Evidence |
|----|-----|--------|----------|
| SEC-01 | Crit | IDOR — đọc message của bất kỳ conversation (thiếu participant check) | `conversations.controller.ts:43` → `src/websockets/chat.service.ts:304` |
| SEC-02 | Crit | IDOR — list conversation theo userId từ URL thay vì `req.user` | `conversations.controller.ts:37` |
| SEC-03 | Crit | WS `joinRoom` không check membership **và không yêu cầu socket đã auth** (`client.userId`) → unauth eavesdrop/inject | `chat.gateway.ts:87-110` |
| SEC-04 | Crit | `/users/*` CRUD không guard (gồm `POST /users` + `users/signup-with-onboarding`); cần class-level guard trên UsersController; `notifications/send-all` chỉ FirebaseAuth (không admin) | `users.controller.ts:31,35,43`, `notifications.controller.ts:92-115` |
| SEC-05 | Crit↑ | Complaints PII IDOR — bất kỳ auth user đọc complaint/identity (cùng class SEC-01, **promote từ red-team**) | `complaints.service.ts:130-145` |
| F-03 | Crit↑ | Leaderboards CRUD **write không guard** (promote — vi phạm "0 unauth-write trước deploy") | `leaderboards.controller.ts:21/35/40` |
| PAY-01 | High | `processPlayerPayment` ghi `has_paid`/status **không verify Stripe** → hỏng paid-state (state này gate payout). KHÔNG trigger payout trực tiếp; route đã sau FirebaseAuthGuard+self-check | `games.service.ts:1312`, `games.controller.ts:188` |
| PAY-08 | Crit↑ | **Double-payout race**: `processGamePayout` check-then-act non-atomic + `payouts.create` KHÔNG idempotency key (webhook idempotency không bảo vệ outbound payout). **Promote từ red-team** | `games.service.ts:1441→1487`, `stripe.service.ts:1060` |
| DB-03 | Crit | Payment-status read-derive-write KHÔNG transactional → lost update dưới concurrency | `games.service.ts:1339-1377` |
| INF-02 | Crit↑ | Không graceful shutdown (Prisma không `$disconnect`) — **promote vào Phase 1** để mọi deploy money/schema phase sau không half-apply | `main.ts`, `prisma.service.ts` |
| INF-03 | Med↓ | `dump-prod-to-dev.sh` xoá table theo `$DATABASE_URL` — **downgrade** (đã có env checks + `read -p`; local CLI, không request-reachable). Fix = dev-host **allowlist** | `dump-prod-to-dev.sh:51-79` |
| PAY-02 | (verify) | Nghi custody fork v1 — **NHƯNG main `createPaymentIntent` CÓ `transfer_data.destination`** (nhất quán). Chỉ TASK: đọc `v1/games:298` xác nhận có khác không (đừng refactor mù) | `stripe.service.ts:1175` vs `v1/games:298` |

## Architecture / cách tiếp cận
- **Authorization layer**: chuẩn hoá mọi controller lấy `uid` từ `req.user` (Firebase guard), không nhận từ param/body. Thêm ownership/participant check ở service (conversation, message, user resource). Với WS, verify membership trước khi `socket.join(room)`.
- **Admin gating**: bọc `notifications/send-all` và mọi route quản trị bằng `AdminGuard` (đã verified fail-closed khi đứng sau FirebaseAuthGuard).
- **Payment trust boundary**: bỏ/khoá đường `processPlayerPayment` client-trusted; trạng thái paid CHỈ được set từ webhook `payment_intent.succeeded` đã verify (hợp nhất với Phase 2). Tạm thời nếu cần giữ endpoint: bắt buộc `stripe.paymentIntents.retrieve()` và đối chiếu amount/metadata server-side.
- **Atomic money writes**: bọc read-derive-write payment status trong `prisma.$transaction` + điều kiện optimistic (where status cũ).
- **Ops safety**: thêm guard ở dump script — chỉ chạy khi host khớp dev whitelist + prompt xác nhận + chặn nếu URL chứa prod host.

## Related Code Files
- Modify: `src/conversations/conversations.controller.ts`, `src/chat/chat.service.ts`, `src/websockets/chat.gateway.ts`
- Modify: `src/users/users.controller.ts`, `src/notifications/notifications.controller.ts`
- Modify: `src/games/games.service.ts`, `src/games/games.controller.ts`, `src/v1/games/*`, `src/stripe/stripe.service.ts`
- Modify: `dump-prod-to-dev.sh`
- Create: regression specs cho từng fix (auth/IDOR + payment verify)

## Implementation Steps
1. Audit & sửa từng controller: thay mọi `userId` lấy từ param/body bằng `req.user.uid`; thêm ownership/participant guard ở service. (SEC-01/02)
2. WS: yêu cầu socket đã authenticate (`client.userId` tồn tại) **trước**, rồi query membership của `uid` trong conversation; reject nếu chưa auth hoặc không thuộc. (SEC-03)
3. UsersController: thêm class-level guard + audit `POST /users`, `users/signup-with-onboarding` — **verify đường signup thật của mobile trước khi guard** để không vỡ đăng ký; bọc `notifications/send-all` bằng `AdminGuard`. (SEC-04)
4. Complaints: thêm ownership/admin check cho đọc complaint. (SEC-05)
5. Leaderboards: gắn guard cho write (hoặc remove nếu là scaffold — phối hợp Phase 4/Q2). (F-03)
6. Payment trust boundary: bỏ tin client ở `processPlayerPayment`; paid-state chỉ set từ webhook đã verify; nếu giữ tạm thì `paymentIntents.retrieve()` + verify amount/currency/metadata. (PAY-01)
7. **Double-payout fix**: bọc `processGamePayout` trong `$transaction` + lock/optimistic guard (where `payout_completed=false`) + truyền **idempotencyKey** vào `payouts.create`. (PAY-08)
8. Bọc cập nhật payment status trong `$transaction` + guard trạng thái cũ. (DB-03)
9. **Graceful shutdown**: `app.enableShutdownHooks()` + Prisma `OnModuleDestroy`→`$disconnect`. (INF-02)
10. Verify task (không refactor): đọc `v1/games:298` xác nhận intent path có khác `createPaymentIntent` (đã có `transfer_data.destination`) không; ghi kết luận vào Open Q1. (PAY-02)
11. Dump script: thêm **dev-host allowlist** + chặn nếu host khớp prod. (INF-03, đã downgrade)
12. Viết regression test cho mỗi fix; chạy `npm test`.

## Success Criteria
- [ ] Không endpoint nào thao tác trên resource người dùng khác mà thiếu ownership check (manual matrix + test).
- [ ] WS join bị từ chối với non-member (test).
- [ ] Không thể mark-paid nếu Stripe không xác nhận (test với amount giả).
- [ ] Payment status update là atomic (concurrent test không lost-update).
- [ ] **Double-payout**: 2 lần `processGamePayout` đồng thời chỉ tạo 1 payout (test concurrent + idempotencyKey).
- [ ] Complaints/leaderboards write không truy cập được bởi user không phận sự.
- [ ] Graceful shutdown: SIGTERM không abort request + Prisma `$disconnect`.
- [ ] Dump script chỉ chạy với dev-host allowlist.
- [ ] Kết luận PAY-02 (v1 flow) ghi vào Open Q1.
- [ ] 0 Critical còn open trong `research/01,02`.

## Risk Assessment
- Thay đổi authz có thể phá luồng hợp lệ → cần authorization matrix + test hồi quy trước khi sửa.
- Khoá một payment flow có thể ảnh hưởng client đang gọi → phối hợp Phase 6 (mobile) trước khi remove cứng.
