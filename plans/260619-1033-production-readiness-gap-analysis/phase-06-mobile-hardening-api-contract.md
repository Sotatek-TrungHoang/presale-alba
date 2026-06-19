---
phase: 6
title: "Mobile Hardening & API Contract"
status: pending
priority: P1
effort: "~13.5d"
dependencies: [2]
---

# Phase 6: Mobile Hardening & API Contract

## Overview
Sửa các contract mismatch phá luồng prod giữa mobile và backend, làm cứng auth resilience + crash safety, và chuẩn hoá release config. Nguồn: `research/07`. Phụ thuộc Phase 2 cho quyết định canonical payment flow.

## Requirements
- Functional: core flow (tạo round, join, pay) không vỡ vì enum/contract; auth tự hồi phục khi token hết hạn.
- Non-functional: không white-screen khi render lỗi; không ship secret giả; secrets qua env.

## Findings xử lý
| ID | Sev | Vấn đề | Evidence (mobile / backend) |
|----|-----|--------|------------------------------|
| MOB-01 | Crit | `EVENING` time slot chọn được & POST `/games` nhưng backend `CreateGameDto` chỉ 4 value → 400, vỡ tạo round | `select-time-slot.tsx:31` / `CreateGameDto` (non-v1) |
| MOB-02 | Crit | Không response interceptor / 401 handling / force-refresh token → token stale = fail không hồi phục | `api/config.ts`, `providers/Auth.tsx` |
| MOB-03 | Crit | Không ErrorBoundary → render throw = white-screen toàn app | app/ root |
| MOB-04 | High | `fetchStripePublishableKey` ship hardcoded `pk_test_...` giả làm fallback, boot StripeProvider bằng key giả | stripe key fetch |
| MOB-05 | High | `UpdatePlayerStatusDto` mobile có `CONFIRMED` nhưng backend chỉ nhận `APPROVED|REJECTED` | mobile DTO / games route |
| MOB-06.. | Med/Low | Không offline/NetInfo; bỏ qua pagination backend cung cấp; axios+token logic lặp ở 6+ file; FB appID/token hardcode `app.config.js`; `eas.json` không có `env`; moderation "User Management" là Coming-Soon stub |

> ~25 endpoint còn lại (games CRUD, stripe onboarding/payments, users/me, conversations, location) **align đúng**. Backend không có global prefix — confirmed.

## Architecture
- **Contract sync**: chốt nguồn enum (Open Q1/Q5) — hoặc thêm `EVENING` vào backend enum, hoặc bỏ khỏi mobile; đồng bộ `CONFIRMED` vs `APPROVED/REJECTED`. Cân nhắc sinh type từ backend (single source of truth) để tránh drift về sau.
- **Auth resilience**: thêm axios response interceptor xử lý 401 → force-refresh Firebase token → retry 1 lần → logout cleanup nếu vẫn fail; gỡ token logic trùng về 1 client dùng chung.
- **Crash safety**: ErrorBoundary ở root + per-screen fallback; đảm bảo Sentry capture.
- **Release hygiene**: bỏ Stripe key giả (fail rõ nếu thiếu key thật); chuyển secret sang `EXPO_PUBLIC_*`/EAS env; rà `app.config.js` version/permissions/OTA runtimeVersion; `eas.json` thêm env blocks; xác nhận `USE_MOCK_DATA=false`.
- **UX resilience**: NetInfo offline handling cho REST flows; dùng pagination backend đã có cho list dài.

## Related Code Files
- Modify: `api/config.ts` (interceptor 401/refresh), `providers/Auth.tsx`
- Modify: create-round timeslot component, mobile DTO types (player status, timeslot)
- Create: root `ErrorBoundary` component
- Modify: Stripe key fetch, `app.config.js`, `eas.json`
- Modify: các `api/*.ts` để dùng client dùng chung + pagination

## Implementation Steps
1. Đồng bộ enum/contract với backend (timeslot EVENING, player status). (MOB-01/05; phụ thuộc Q1/Q5)
2. Thêm axios interceptor 401 → refresh → retry → logout cleanup; gộp axios client dùng chung. (MOB-02)
3. Thêm ErrorBoundary root + fallback + verify Sentry. (MOB-03)
4. Bỏ Stripe key giả; fail-fast khi thiếu key; di chuyển secrets sang env/EAS. (MOB-04, release)
5. Thêm NetInfo offline + dùng pagination backend cho list dài. (MOB-06)
6. Rà release config (`app.config.js`, `eas.json`, OTA runtimeVersion, permissions); build dev client test.
7. Xử lý moderation "User Management" stub (implement/ẩn theo PM).

## Success Criteria
- [ ] Tạo round với mọi timeslot UI cho phép đều thành công (không 400).
- [ ] Token hết hạn → app tự refresh & tiếp tục; logout dọn sạch state (test).
- [ ] Render lỗi hiển thị fallback, không white-screen.
- [ ] Không còn key/secret giả trong bundle; secrets qua env.
- [ ] Contract mismatch giữa mobile & backend = 0 (đối chiếu lại matrix).

## Risk Assessment
- Quyết định enum nằm 2 đầu (mobile+backend) → cần release đồng bộ; OTA mobile không sửa được backend enum.
- Interceptor refresh sai gây vòng lặp 401 → test kỹ race & retry-once.
- Phụ thuộc Phase 2: nếu canonical payment flow đổi route, contract mobile phải cập nhật theo.
