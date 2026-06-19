---
phase: 8
title: "Game Performance Optimization"
status: pending
priority: P2
effort: "~6md core / ~10md full"
dependencies: [3]
---

# Phase 8: Game Performance Optimization

## Overview
Tối ưu performance riêng cho domain **games/rounds** (nearby, suggested, my-games, payout-review) — phần chưa được bóc tách thành hạng mục độc lập trong các phase trước. Mục tiêu: list endpoint không full-scan/over-fetch, query đắt (suggested/nearby) có cache, fix N+1 ở payout review, và mobile có query-cache + perceived latency tốt hơn.

> **Overlap notice (không double-count):** một phần đã được estimate ở **Phase 3** (DB-05 FK index, DB-07 pagination diện rộng). Phase này chỉ tính **net-new** cho game-specific + đánh dấu mục "covered by Phase 3" để tránh trùng. Nguồn: scout `games.service.ts` (~2200 LOC), `api/games.ts`, hooks `useMyGames`/`useGameDetail`/`useGameActions`.

## Requirements
- Functional: kết quả nearby/suggested/my-games không đổi về nghiệp vụ; list có giới hạn bản ghi.
- Non-functional: query suggested/nearby không tính lại social-graph + Haversine mỗi request; admin payout-review không phát query/creator; payload list không kèm nested không cần thiết.

## Findings xử lý

| ID | Sev | Vấn đề | Evidence | Est (md) |
|----|-----|--------|----------|:-:|
| PERF-01 | High | N+1 `firstPayment` loop từng creator ở payout-review | `games.service.ts:2059-2070` | 0.5 |
| PERF-02 | High | Game model thiếu index `date`/`status`/composite (non-FK, ngoài DB-05) | `schema.prisma` Game | 0.5 |
| PERF-03 | Med | Không cache `getSuggestedGames`/`getNearbyGames` dù cache-manager đã cài | `games.service.ts:933,1806`, `app.module.ts:59` | 2.0 |
| PERF-04 | Med | Game list endpoints unbounded (nearby/myGames/suggested) | `games.service.ts:933,1548,1806` | covered by DB-07 (Phase 3) |
| PERF-05 | Med | Haversine in-app + fetch-then-JS-filter thay vì PostGIS | `games.service.ts:1006-1033` | 2.0 *(defer-candidate)* |
| PERF-06 | Med | Over-fetch include (full creator.profile, players.user.profile, conversation) cho list card | `games.service.ts:993-1002` | 1.0 |
| PERF-07 | Med | Mobile không query-cache (no react-query/SWR), refetch mọi focus, no debounce | `api/games.ts`, `hooks/useMyGames.ts:65-69` | 2.0 |
| PERF-08 | Low | Mobile no optimistic update (join/approve) + no image cache avatar | `hooks/useGameActions.ts`, `components/game/*` | 1.5 |

> Verified positive: bounding-box pre-filter đã có trước Haversine (`:1006`); `select` narrowing đã dùng ở suggested (`:1920`); `$transaction` đã dùng ở approve/reject (`:487-570`); `FlatList` virtualization + `useCallback`/`useMemo` đã có ở mobile. Đây là tối ưu đúng hướng, không cần làm lại.

---

## Findings chi tiết

### PERF-01 — [High] N+1 `firstPayment` query trong `getGamesForPayoutReview`
- **Evidence:** `games.service.ts:2031-2117`; vòng lặp `:2059-2070` query `transaction.findFirst`/firstPayment riêng cho **mỗi creator_id**.
- **Impact:** 100 game với 50 creator unique = 50 query phụ/lần admin mở payout-review. Tuyến tính theo số creator, chậm dần khi data lớn; admin dashboard nghẽn.
- **Fix:** Batch bằng `findMany` group theo `creator_id` (1 query) rồi map in-memory; hoặc `groupBy`. Loại loop-per-creator.
- **Estimate:** 0.5 man-day.

### PERF-02 — [High] Thiếu index trên field filter của Game (`date`, `status`, composite)
- **Evidence:** `schema.prisma` model Game — không `@@index` cho `date`, `status`; các query lọc `date`/`status`/`creator_id` ở `getNearbyGames` (`:981-989`), `getMyGames` (`:1548`), `getSuggestedGames` (`:1806`).
- **Impact:** Phase 3 DB-05 phủ FK index (`creator_id`, `course_id`, `group_id`), **nhưng `date`/`status` là non-FK** không nằm trong DB-05 → vẫn seq-scan trên các filter phổ biến nhất của game list.
- **Fix:** Thêm `@@index([status, date])` + `@@index([creator_id, status, date])` cho Game; migration. **Phối hợp với Phase 3 để gộp 1 migration index, tránh 2 lần lock bảng.**
- **Estimate:** 0.5 man-day (net-new ngoài DB-05).

### PERF-03 — [Medium] Không cache query đắt nearby/suggested
- **Evidence:** `getNearbyGames` (`:933`) và `getSuggestedGames` (`:1806`) tính lại bounding-box fetch + Haversine + social-graph (4 query: follows/groups/past-mates `:1940-1998`) + scoring **mỗi request**. `@nestjs/cache-manager` đã cấu hình (`app.module.ts:59`) nhưng games service không dùng.
- **Impact:** Suggested ~1-2s/request, tính lại social graph mỗi lần; tốn CPU/DB khi nhiều user poll feed.
- **Fix:** Cache theo key `(userId, bbox-bucket, dateBucket)` TTL ngắn (30-60s) cho nearby; cache social-graph per-user TTL 5-10 phút (invalidations khi follow/join). Dùng cache-manager sẵn có. **Lưu ý:** nếu deploy multi-instance, cần Redis store (gắn với INF-05/06 ở Phase 5 — hiện defer D1).
- **Estimate:** 2.0 man-days.

### PERF-04 — [Medium] Game list endpoints unbounded
- **Evidence:** `getNearbyGames` (`:933`), `getMyGames` (`:1548`), `getSuggestedGames` slice in-memory limit 1000 (`:2023`) — không cursor/offset chuẩn.
- **Impact:** Response không giới hạn → OOM mobile + payload nặng khi data lớn.
- **Fix:** Áp chuẩn pagination (cursor + max take) đang định nghĩa ở **Phase 3 / DB-07** cho các endpoint game này.
- **Estimate:** **Covered by DB-07 (Phase 3)** — không tính riêng; chỉ cần đảm bảo game endpoints nằm trong scope DB-07.

### PERF-05 — [Medium] Haversine ở application layer (defer-candidate)
- **Evidence:** `games.service.ts:1006-1033` — fetch theo bounding box rồi tính khoảng cách bằng JS, filter sau.
- **Impact:** Bounding-box đã giảm tải (tốt), nhưng ở 10K+ game/khu vực dày, JS-filter vẫn tốn. Chính xác hơn + nhanh hơn nếu để DB tính.
- **Fix:** Cân nhắc PostGIS (`earthdistance`/`cube` hoặc `geography` + `ST_DWithin`) để pre-filter ở DB. **Đây là defer-candidate** — chỉ làm khi mật độ game/độ trễ thực đo vượt ngưỡng; bounding-box hiện tại đủ cho launch scale.
- **Estimate:** 2.0 man-days *(defer trừ khi đo thấy nghẽn thật)*.

### PERF-06 — [Medium] Over-fetch include cho list card
- **Evidence:** `getNearbyGames` include full `creator.profile` + `players[].user.profile` (`:993-1002`) dù card list chỉ cần tên + count + status.
- **Impact:** Payload phình, parse chậm trên RN, băng thông tốn; N rows × nested profile.
- **Fix:** Dùng `select` narrow xuống field cần cho card (id, name, avatar_url, status, players_current/needed, course{id,name,lat,lng}); giữ full include chỉ ở `findOne` detail.
- **Estimate:** 1.0 man-day.

### PERF-07 — [Medium] Mobile không có query-cache + refetch mọi focus
- **Evidence:** `api/games.ts` axios trực tiếp; `hooks/useMyGames.ts:65-69` `useFocusEffect` refetch **mỗi lần focus**, không debounce, không dedupe; không react-query/SWR.
- **Impact:** Request trùng khi user chuyển tab nhanh; không stale-while-revalidate → loading lại liên tục, tốn băng thông + pin.
- **Fix:** Giới thiệu **TanStack Query (react-query)** cho games endpoints: cache + dedupe + staleTime + background refetch. Tối thiểu: thêm debounce 5-10s cho focus-refetch nếu chưa muốn full react-query.
- **Estimate:** 2.0 man-days (setup react-query + migrate games hooks).

### PERF-08 — [Low] Mobile no optimistic update + no image cache
- **Evidence:** `hooks/useGameActions.ts` — join/approve/confirm chờ server mới update UI; avatar load HTTP mỗi render (`components/game/*`).
- **Impact:** UI lag khi duyệt/join; ảnh tải lại gây jank list.
- **Fix:** Optimistic update local state + rollback on error (tự nhiên khi đã có react-query — `onMutate`); dùng `expo-image` (có cache) cho avatar.
- **Estimate:** 1.5 man-days.

---

## Architecture
- **Backend:** batch query (PERF-01); index migration gộp với Phase 3 (PERF-02/04); cache-manager layer cho suggested/nearby + social-graph (PERF-03); DTO `select` narrowing cho list (PERF-06). PostGIS optional (PERF-05).
- **Mobile:** react-query là backbone — giải quyết PERF-07 + mở đường optimistic update PERF-08 cùng lúc. `expo-image` cho avatar.

## Related Code Files
- Modify: `src/games/games.service.ts` (PERF-01/03/06), `prisma/schema.prisma` + migration (PERF-02)
- Create: `src/games/games-cache.helper.ts` hoặc cache trong service (PERF-03)
- Modify mobile: `api/games.ts`, `hooks/useMyGames.ts`, `hooks/useGameDetail.ts`, `hooks/useGameActions.ts`; add react-query provider
- (Optional) migration PostGIS (PERF-05)

## Implementation Steps
1. PERF-01: thay loop firstPayment bằng 1 batch query. (0.5)
2. PERF-02: thêm Game `@@index([status,date])` + composite; **gộp migration với Phase 3**. (0.5)
3. PERF-06: `select` narrow cho nearby/myGames list. (1.0)
4. PERF-03: cache nearby (TTL ngắn) + social-graph per-user; invalidate khi follow/join. (2.0)
5. PERF-07: thêm react-query, migrate games hooks; staleTime + dedupe. (2.0)
6. PERF-08: optimistic update + `expo-image`. (1.5)
7. (Defer) PERF-05: PostGIS chỉ khi đo thấy nghẽn. (2.0)

## Success Criteria
- [ ] `EXPLAIN` cho nearby/myGames dùng index `status/date`, không seq-scan.
- [ ] Payout-review: số query không tăng theo số creator (verify bằng query log).
- [ ] Suggested/nearby lần 2 trong TTL trả từ cache (đo response time giảm).
- [ ] List endpoint trả payload narrow (không nested profile thừa).
- [ ] Mobile: chuyển tab nhanh không phát request trùng (react-query dedupe).
- [ ] Join/approve cập nhật UI tức thì (optimistic), rollback đúng khi lỗi.

## Risk Assessment
- Cache invalidation sai → stale feed; mitigations: TTL ngắn + invalidate event-driven.
- Multi-instance cache cần Redis (gắn INF-05/06, đang defer D1) — nếu single-instance thì in-memory đủ.
- react-query migration đụng nhiều hook → rollout có smoke test (phối Phase 7).
- Index migration trên bảng lớn cần `CONCURRENTLY` (đồng bộ Phase 3).

## Estimate
- **Core (PERF-01/02/03/06/07): ~6 man-days** — đáng làm cho go-live nếu performance là deliverable.
- **Full (+ PERF-08 + PERF-05 PostGIS): ~10 man-days.**
- PERF-04 = 0 net (covered Phase 3 DB-07).

## Next Steps / Dependencies
- **Phụ thuộc Phase 3:** gộp index migration (PERF-02) + dùng chuẩn pagination DB-07 (PERF-04).
- **Liên quan Phase 5:** Redis store nếu multi-instance (PERF-03 cache) — chờ quyết D1/INF-05.
- **Liên quan Phase 7:** react-query migration cần smoke test mobile.

## Open questions
1. Performance có phải deliverable go-live hay defer post-launch? (quyết core 6md vs full 10md)
2. Deploy single-instance hay multi? → quyết in-memory cache vs Redis cho PERF-03 (gắn Open Q3 của plan).
3. Đồng ý đưa **react-query** vào mobile stack? (ảnh hưởng PERF-07/08 + Phase 6/7)
