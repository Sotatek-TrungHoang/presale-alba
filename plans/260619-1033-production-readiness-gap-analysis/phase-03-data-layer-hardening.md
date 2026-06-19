---
phase: 3
title: "Data Layer Hardening"
status: pending
priority: P1
effort: "~12d"
dependencies: []
---

# Phase 3: Data Layer Hardening

## Overview
Làm cứng tầng dữ liệu để chịu tải prod và không rò rỉ/hỏng dữ liệu: thêm index FK, enforce soft-delete nhất quán, pagination cho list lớn, sửa unique constraint xung đột soft-delete, và transaction cho multi-step write. Nguồn: `research/05` (44 models, 48 migrations).

## Requirements
- Functional: read không trả row đã soft-delete; tạo lại quan hệ đã soft-delete không vỡ unique.
- Non-functional: query chat/list không full-scan; list endpoint có giới hạn; financial/state writes atomic.

> **Red-team notes:** (1) `chat.service.ts` = `src/websockets/chat.service.ts`. (2) Index `Message` dùng `CREATE INDEX CONCURRENTLY` (raw SQL migration). (3) Partial unique index (`WHERE deleted_at IS NULL`) **không biểu diễn được trong Prisma schema** → raw SQL migration ⇒ tiêu chí "no drift" chấp nhận unmanaged index có document. (4) Soft-delete extension ~287 call-sites → KHÔNG parallelize với Phase 2 payout reads.

## Findings xử lý
| ID | Sev | Vấn đề | Evidence |
|----|-----|--------|----------|
| DB-01 | Crit | Không index `Message.conversation_id` + fetch unbounded → full scan bảng lớn nhất | `chat.service.ts:305`, `schema.prisma` Message |
| DB-02 | Crit | Soft-deleted message/conversation rò rỉ ra client (không filter `deleted_at` trong chat reads) | `chat.service.ts:251,305,159,216,323` |
| DB-05 | High | Thiếu FK index diện rộng (chỉ 6/44 model có `@@index`) | `schema.prisma` (FK fields) |
| DB-06 | High | Unique constraint của Follow/GamePlayer/Like/Block bỏ qua `deleted_at` → tạo lại cặp đã soft-delete vỡ unique | `schema.prisma` (các model đó) |
| DB-07.. | Med | Unbounded `findMany` thiếu pagination ở nhiều list | services `findMany` |
| DB-xx | Med/Low | onDelete behavior thiếu, nullable nên required, migration drift | `schema.prisma`, `prisma/migrations` |

> Verified positive: tiền là `Int` (pence) — không có Float-for-money bug; `$transaction` đã dùng ở 16 chỗ (pattern có sẵn, chỉ áp dụng chưa nhất quán).

## Architecture
- **Soft-delete enforcement**: thay vì filter tay rải rác (dễ quên → DB-02), áp dụng Prisma Client Extension / middleware để mặc định loại `deleted_at != null` cho read, hoặc helper query bắt buộc. Bổ sung ngay filter còn thiếu trong chat reads.
- **Indexing**: thêm `@@index` cho mọi FK + field dùng trong WHERE/ORDER BY (đặc biệt `Message.conversation_id`, `created_at`); tạo migration.
- **Unique + soft-delete**: chuyển sang partial unique index (`WHERE deleted_at IS NULL`) cho Follow/GamePlayer/Like/Block.
- **Pagination**: chuẩn hoá cursor/limit cho list lớn (chat, posts, notifications…); default take + max cap.
- **Transactions**: bọc multi-step write còn thiếu (đồng bộ với DB-03 ở Phase 1, các state write khác).

## Related Code Files
- Modify: `prisma/schema.prisma` (+ migrations mới)
- Create: `src/prisma/soft-delete.extension.ts` (hoặc middleware) + áp dụng ở `PrismaService`
- Modify: `src/chat/chat.service.ts` và các service có list/`findMany`
- Create: migration scripts + verify không drift

## Implementation Steps
1. Thêm filter `deleted_at` còn thiếu trong chat reads ngay (DB-02), rồi triển khai cơ chế enforce toàn cục.
2. Thêm `@@index` cho `Message.conversation_id` + FK toàn schema; tạo & test migration. (DB-01/05)
3. Chuyển unique constraint sang partial index loại trừ soft-deleted. (DB-06)
4. Chuẩn hoá pagination (cursor + max take) cho list endpoints lớn. (DB-07)
5. Rà onDelete/nullable/required; bổ sung referential actions. (DB-medium)
6. Bọc multi-step writes còn thiếu trong `$transaction`. (đồng bộ DB-03)
7. Kiểm tra drift: `prisma migrate diff` schema vs migrations; viết test query quan trọng.

## Success Criteria
- [ ] `EXPLAIN` query mở chat dùng index, không seq scan.
- [ ] Read không bao giờ trả row `deleted_at != null` (test cho chat + ≥3 module khác).
- [ ] Tạo lại Follow/GamePlayer đã soft-delete không lỗi unique (test — đang là bug active vì GamePlayer soft-delete khi decline).
- [ ] List endpoint lớn đều có giới hạn bản ghi.
- [ ] `prisma migrate diff` = no drift.

## Risk Assessment
- Migration index trên bảng lớn cần `CONCURRENTLY`/maintenance window ở prod.
- Soft-delete extension toàn cục có thể đổi hành vi query hiện hữu → rollout có test + cờ.
- Partial unique index cần Postgres (đã dùng) — OK.
