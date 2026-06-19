---
phase: 2
title: "Payment System Completion"
status: pending
priority: P1
effort: "~8d"
dependencies: [1]
---

# Phase 2: Payment System Completion

## Overview
Hoàn thiện hệ thống thanh toán đúng theo vision: 1 luồng canonical, **2-day hold rồi auto-payout**, refund khi huỷ, payout idempotent & transactional, có reconciliation. Webhook signature + idempotency hiện đã đúng — giữ nguyên, xây tiếp trên đó. Nguồn: `research/02`.

## Requirements
- Functional: đủ vòng đời tiền (charge → hold 2 ngày sau game → payout / refund / cancel). Mọi state transition có nguồn sự thật từ webhook đã verify.
- Non-functional: không double-payout; không stranded funds; mọi money-write atomic; có log/audit money events.

## Findings xử lý
> **Red-team corrections:** PAY-08 (double-payout) đã chuyển sang **Phase 1**. Webhook payout handlers (`handlePayoutPaid/Failed/Pending`) ĐÃ tồn tại + dedup verified-clean — **KHÔNG rebuild**, chỉ sửa bug cụ thể.

| ID | Sev | Vấn đề | Evidence |
|----|-----|--------|----------|
| PAY-02 | High | Verify v1 intent path: main `createPaymentIntent` đã dùng `transfer_data.destination` (nhất quán). Chỉ hợp nhất/khoá flow NẾU `v1/games:298` thực sự khác — kết luận từ task verify Phase 1 | `stripe.service.ts:1175` vs `v1/games:298` |
| PAY-03 | Crit | "2-day hold + auto-payout" CHƯA implement (`schedule: manual`). Cron là **Railway one-shot** (không `@nestjs/schedule`); cần provisioning + có error path "deployed-but-not-scheduled"; reconcile với cron `payout-on-its-way` đang tồn tại (có thể lệch timing) | `stripe.service.ts:553`, `CRON.md`, `src/cron/*` |
| PAY-04 | High | Không có `cancelGame`/refund-on-cancel → huỷ game làm kẹt tiền người chơi | (absent — grep confirmed) |
| PAY-06 | High | Bug cụ thể: `handlePayoutFailed` KHÔNG reset `payout_completed=false`; set đồng bộ `payout_completed=true` ở `games.service.ts:1512` (không chờ `payout.paid`) | `stripe.service.ts:2014/2175`, `games.service.ts:1512` |
| PAY-05/07 | Med | Reconciliation gaps: webhook không tới, retry, currency/rounding edge | `stripe-webhook.controller.ts` |

> Webhook signature verification + dedup qua `transactionEventLog.stripe_event_id` trong `$transaction` = **verified OK**, giữ nguyên — đừng đụng vào path này.

## Architecture
- **Canonical flow (sau Open Q1)**: chọn Stripe Connect destination charges (`transfer_data` / `on_behalf_of`) HOẶC separate charges+transfers nhất quán; xoá flow còn lại. Tiền custody phải khớp nguồn payout.
- **Hold + auto-payout**: thêm scheduled job (theo kiến trúc cron one-shot hiện có ở `src/cron`, đã đánh giá tốt) quét game đã hoàn tất > 2 ngày, chưa dispute → tạo payout transactional, idempotent (guard bằng trạng thái + event log).
- **Cancel/refund**: thêm `cancelGame` use-case → refund các player đã trả (Stripe refund) + cập nhật trạng thái atomic.
- **Payout integrity**: payout chỉ set completed khi nhận webhook `payout.paid`; `payout.failed` reopen; toàn bộ bọc `$transaction` + idempotency key.

## Related Code Files
- Modify: `src/stripe/stripe.service.ts`, `src/stripe/stripe-webhook.controller.ts`, `src/games/games.service.ts`, `src/v1/games/*`
- Create: `src/cron/payout-hold.runner.ts` (+ Railway service theo CRON.md pattern)
- Create: cancel/refund use-case trong games hoặc stripe module
- Create: specs cho hold/payout/refund/cancel + idempotency

## Implementation Steps
1. Chốt canonical flow với khách hàng; refactor để custody ↔ payout source khớp; xoá flow thừa. (PAY-02)
2. Implement scheduled payout-hold runner: chọn game completed > 2d, no open complaint, chưa payout → payout transactional + idempotent. (PAY-03)
3. Implement `cancelGame`: refund player đã trả, cập nhật trạng thái atomic, notify. (PAY-04)
4. Sửa payout lifecycle: completed chỉ qua `payout.paid` webhook; `payout.failed` reopen; bọc `$transaction`. (PAY-06/08)
5. Reconciliation: job đối soát PaymentIntent vs Transaction; xử lý webhook-miss + retry; chuẩn hoá currency/rounding. (PAY-05/07)
6. Thêm money-event audit log; viết test toàn bộ vòng đời tiền.

## Success Criteria
- [ ] Chỉ còn 1 payment flow; custody khớp payout (test).
- [ ] Game completed > 2d tự payout đúng 1 lần (idempotency test).
- [ ] Huỷ game refund đúng player; không stranded funds (test).
- [ ] Double-trigger payout không tạo payout thứ 2 (test).
- [ ] Reconciliation phát hiện & xử lý webhook-miss (test).

## Risk Assessment
- Tiền thật → mọi thay đổi cần test trên Stripe test-mode + sandbox webhook trước.
- Refactor canonical flow blast radius lớn; làm sau khi Phase 1 đã khoá flow nguy hiểm.
- Phối hợp Phase 6: contract mobile (`/games` vs `/v1/games`) phụ thuộc quyết định ở bước 1.
