---
phase: 7
title: "Test Coverage & Quality Gate"
status: pending
priority: P2
effort: "~30d (mobile từ-zero realistic ~20-40d; risk-target cho launch để giảm)"
dependencies: [1, 5]
---

# Phase 7: Test Coverage & Quality Gate

## Overview
Xây lưới an toàn hồi quy trước go-live: viết test cho money/auth/games (backend) và toàn bộ mobile (gần như chưa có test thật), bật coverage gate, sửa docs test sai sự thật, và siết TypeScript strict. Nguồn: `research/06`. Phụ thuộc Phase 5 (CI để gate có hiệu lực).

## Requirements
- Functional: critical path (payment, auth/guard, game state machine, webhook) có test behavior thật.
- Non-functional: coverage gate enforced trong CI; build/typecheck sạch; docs test phản ánh đúng.

## Findings xử lý
| ID | Sev | Vấn đề | Evidence |
|----|-----|--------|----------|
| TEST-01 | Crit | Mobile gần như 0 test thật (163 source / 1 test no-op assert `null`) | `alba-golf-rn-main/__tests__/` |
| TEST-02 | Crit | `TESTING.md` mô tả bộ test KHÔNG tồn tại trên đĩa; `coverage/` cũ gây hiểu nhầm | `TESTING.md` vs disk |
| TEST-03 | Crit | Không CI ở cả 2 repo → test/lint/build không chạy tự động | `.github/` absent (đồng bộ INF-01) |
| TEST-04/05 | High | Mobile threshold 70% không đạt & không enforce; backend KHÔNG có coverage threshold; `update-game.test.ts` bị `testRegex` loại âm thầm | `package.json` cả 2 repo |
| TEST-06 | High | Backend tsconfig non-strict (`strictNullChecks`/`noImplicitAny` = false); mobile strict | `tsconfig.json` (BE) |
| TEST-07.. | – | Backend module 0 spec: notifications (2296 LOC), websockets (802), cron (665), blocks/reports/round/attribution | các dir đó |

> Positive: backend payments/games test tốt — `stripe.service.spec.ts` (3379 ln), `game-payout-with-complaints.spec.ts` (767 ln, assert hành vi thật). Giữ & mở rộng.
> Lưu ý: agent **không chạy được** jest/tsc (node_modules bị chặn bởi env hook) → pass/fail & %coverage là **[UNVERIFIED]**; cần chạy thật khi thực thi.

## Architecture
- **Ưu tiên risk-based**: viết test cho phần đụng tiền/auth trước (đồng bộ fix Phase 1/2), rồi module 0-spec.
- **Mobile suite**: dựng harness thật (jest-expo + @testing-library/react-native), smoke render các screen chính + test critical flow (auth, create-round, join, pay UI, error states). Sửa/làm lại `TESTING.md` cho đúng; xoá coverage artifact cũ.
- **Coverage gate**: bật threshold backend; enforce threshold mobile; chạy trong CI (Phase 5) — chặn merge khi dưới ngưỡng cho path quan trọng.
- **TS strict**: bật `strictNullChecks`/`noImplicitAny` backend theo lộ trình (per-module hoặc incremental) để lộ null-bug.
- **Fix test config**: sửa `testRegex` để không loại âm thầm file test (`update-game.test.ts`).

## Related Code Files
- Create: mobile `__tests__/**` (smoke + critical flow), sửa `alba-golf-rn-main/TESTING.md`
- Create: backend spec cho notifications/websockets/cron/blocks/reports/round/attribution
- Modify: `alba-social-backend-main/package.json` (coverage threshold, testRegex), `tsconfig.json` (strict)
- Modify: CI workflow (Phase 5) để chạy coverage gate

## Implementation Steps
1. Sửa `testRegex` + thêm coverage threshold backend; chạy suite hiện có, ghi nhận pass/fail thật (gỡ [UNVERIFIED]). (TEST-04)
2. Viết test cho fix Phase 1/2 (IDOR/authz, payment verify, payout idempotency, cancel/refund). (đồng bộ P1/P2)
3. Dựng mobile test harness; smoke render + critical-flow tests; sửa `TESTING.md`; xoá coverage cũ. (TEST-01/02)
4. Bổ sung spec cho module backend 0-test (ưu tiên notifications/websockets/cron). (TEST-07)
5. Bật TS strict backend theo lộ trình; sửa null-bug phát sinh. (TEST-06)
6. Kết nối coverage gate vào CI (Phase 5); chặn merge khi path quan trọng dưới ngưỡng. (TEST-03/05)

## Success Criteria
- [ ] Money/auth/games/webhook có test behavior thật, xanh trong CI.
- [ ] Mobile có smoke + critical-flow tests chạy được; `TESTING.md` đúng sự thật.
- [ ] Coverage gate enforced (BE threshold mới, RN 70% thực thi) trong CI.
- [ ] `npx tsc --noEmit` sạch ở cả 2 repo; backend strict bật (hoặc lộ trình rõ).
- [ ] Không file test bị loại âm thầm bởi config.

## Risk Assessment
- Bật strict backend có thể lộ nhiều null-bug → làm incremental, không big-bang.
- Mobile từ 0 → có test tốn công nhất (~12 md) — là hạng mục lớn nhất plan; cân nhắc gate go-live ở critical flow trước, mở rộng coverage sau.
- Coverage gate chỉ có nghĩa khi CI (Phase 5) đã chạy → giữ thứ tự phụ thuộc.
