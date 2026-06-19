---
phase: 4
title: "Feature Completeness & Code Health"
status: pending
priority: P2
effort: "~15d"
dependencies: [1]
---

# Phase 4: Feature Completeness & Code Health

## Overview
Dọn lớp "scaffold leftover" của NestJS generator (nhiều stub đang nối với route live), bổ sung endpoint còn thiếu, và giảm nợ kỹ thuật (god services, console logging, generic errors). Core domain ~70-75% thật; phase này đưa về production-clean. Nguồn: `research/03`.

## Requirements
- Functional: không còn route live trả placeholder; endpoint còn thiếu được implement hoặc gỡ bỏ có chủ đích.
- Non-functional: error → HTTP exception đúng (không 500 trần); logging có cấu trúc; file lớn được tách.

## Findings xử lý
| ID | Sev | Vấn đề | Evidence |
|----|-----|--------|----------|
| F-01 | High | Course CRUD stub trả placeholder, route live | `courses.service.ts:180/891/895`, `courses.controller.ts:40/136/141` |
| F-02 | High | Profiles CRUD stub + route-ordering bug (`@Get(':id')` trước `@Get('user-profile')`) | `profiles.service.ts:165/169/466`, `profiles.controller.ts` |
| F-03 | →P1 | Leaderboards write stub KHÔNG guard — **đã promote sang Phase 1** (chỉ còn phần implement-vs-remove ở đây, chờ Q2) | `leaderboards.controller.ts:21/35/40` |
| F-04 | High | `chat.getMessages` không pagination (unbounded) | `chat.service.ts:304` (đồng bộ DB-01) |
| F-05 | High | God services: `games.service.ts` ~2200 LOC, notifications ~1504, users ~1370 | các file đó |
| F-06 | Med | ~16 method placeholder `'This action...'`; 2 file chết (`messages.service.ts`, `conversations.service.ts`) | grep |
| F-07 | Med | 15 `throw new Error` (→500) + 201 `console.*` trong prod path | grep src/ |
| F-08 | Med | `+id` coercion trên cuid string → NaN (4 controller); groups `Delete :id` live stub; thiếu game-delete, post-edit/delete; trùng `games` vs `v1/games` | controllers liên quan |

## Architecture
- **Stub triage (cần Open Q2)**: mỗi route live-stub → quyết định *implement* hay *remove*. Public CRUD (courses/profiles/leaderboards) phải gắn guard phù hợp nếu giữ.
- **Error handling**: thay `throw new Error` bằng Nest HTTP exceptions; chuẩn hoá response shape.
- **Logging**: thay `console.*` bằng Nest `Logger`/structured logger (đồng bộ observability Phase 5).
- **Refactor god services**: tách theo concern (games → suggestion/payment/lifecycle), giữ behavior; làm sau khi có test (Phase 7) để an toàn.
- **Cleanup**: xoá file chết, sửa route ordering, sửa id coercion (dùng string cuid), gỡ surface API trùng.

## Related Code Files
- Modify: `src/courses/*`, `src/profiles/*`, `src/leaderboards/*`, `src/groups/*`, `src/chat/chat.service.ts`
- Modify: `src/games/games.service.ts` (+ tách module), `src/notifications/*`, `src/users/*`
- Delete: `src/messages/messages.service.ts`, `src/conversations/conversations.service.ts` (sau khi xác nhận dead)
- Modify: các controller có `+id` coercion

## Implementation Steps
1. Triage toàn bộ stub `'This action...'` với PM (implement vs remove). (F-06)
2. Implement/Remove course & profile CRUD; sửa route ordering profiles. (F-01/02)
3. Xử lý leaderboards CRUD: implement + guard, hoặc remove. (F-03; phối hợp SEC)
4. Thêm pagination `getMessages` (đồng bộ Phase 3 DB-01). (F-04)
5. Thay generic errors → HTTP exceptions; thay console.* → Logger. (F-07)
6. Sửa `+id` coercion (string cuid), xoá file chết, gỡ API trùng `games`/`v1/games`. (F-08)
7. Refactor god services theo concern (sau khi Phase 7 có test bao phủ). (F-05)
8. Bổ sung endpoint thiếu nếu là yêu cầu go-live (game-delete, post-edit/delete).

## Success Criteria
- [ ] 0 route live trả placeholder string (grep + manual).
- [ ] 0 `console.*` trong prod path; 0 `throw new Error` trần ở service.
- [ ] `/profiles/user-profile` route đúng handler (test).
- [ ] File chết đã xoá; không còn API surface trùng gây nhầm.
- [ ] God services tách xuống <~800 LOC/đơn vị (hoặc có kế hoạch rõ).

## Risk Assessment
- Refactor god services rủi ro hồi quy cao → bắt buộc có test trước (phụ thuộc Phase 7).
- Remove API trùng có thể phá mobile → đồng bộ Phase 6 contract.
- Quyết định implement-vs-remove cần PM (Open Q2) trước khi code.
