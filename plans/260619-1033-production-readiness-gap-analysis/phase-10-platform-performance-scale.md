---
phase: 10
title: "Platform Performance & Scale (non-games)"
status: pending
priority: P1
effort: "~14–19md"
dependencies: [3]
---

# Phase 10: Platform Performance & Scale (non-games)

## Overview
Làm cứng các hot-path **ngoài domain games** để chịu tải **growth-ready (10k+ users)** theo quyết định scale: posts/feed N+1, leaderboards/courses/user-search full-scan + index, notifications pagination, rate-limiting/anti-spam, moderation enforcement, websocket memory-leak. Nguồn: `reports/09-coverage-matrix-uncovered-dimensions.md` #15-23.

> **Phối Phase 3 & Phase 8:** index/pagination dùng chuẩn DB-07; gộp migration với Phase 3 để không lock bảng nhiều lần. Games perf đã ở Phase 8 — phase này KHÔNG đụng games.
> **Overlap Phase 5 (INF):** RATE-01 (throttler+helmet) trùng một phần high-sev "thiếu throttler+helmet" của reliability audit → đánh dấu, không double-count.

## Requirements
- Functional: search/feed/leaderboard trả đúng + có giới hạn bản ghi; block ẩn content 2 chiều; report apply action.
- Non-functional: list endpoint không full-scan; write có rate-limit; WS không leak memory theo ngày.

## Findings xử lý

| ID | Sev | Vấn đề | Evidence | Est |
|----|-----|--------|----------|:-:|
| SCALE-01 | Crit | Posts/feed include cây sâu → N+1 (100 post → 500-1500 query) | `posts.service.ts:126-184` | 2–3 |
| SCALE-02 | Crit | Leaderboards `findMany` unbounded + nested | `leaderboards.service.ts:31-46` | 1–1.5 |
| SCALE-03 | High | Courses search ILIKE full-scan + hardcode `.take(5)` | `courses.service.ts:323-360` | 1.5–2 |
| SCALE-04 | High | User search ILIKE không index (Profile thiếu `@@index`) | `users.service.ts:259-267`, `schema.prisma` Profile | 1.5–2 |
| SCALE-05 | Med | Notifications list không pagination | `notifications.service.ts:158-177` | 0.5 |
| RATE-01 | High | Không rate-limit/helmet → spam posts/messages/join/complaints | `app.module.ts` (no throttler) | 1.5–2 *(overlap INF)* |
| MOD-01 | High | Report log không apply action + complaint không dedup | `reports.service.ts:14-57`, `complaints.service.ts:32-69` | 2–3 |
| MOD-02 | High | Block không enforce ở feed/group (chỉ DM) | `chat.service.ts:122-144` vs feed/group reads | 1.5–2 |
| WS-01 | Med | `activeUsers`/`notificationTimeouts` Map không evict; passive disconnect không fire | `chat.service.ts:38-52,30,561-568` | 2–3 |
| WS-02 | Med | Reconnect không re-auth → banned user vẫn gửi | `chat.gateway.ts:50-85` | 1–1.5 |

> Verified CLEAN: WS room cleanup (`chat.gateway.ts:42-48`), block check ở DM 2 chiều, socket.io listener lifecycle chuẩn — không làm lại.

---

## Findings chi tiết

### SCALE-01 — [Critical] Posts/feed N+1 + over-fetch
- **Evidence:** `posts.service.ts:126-184` `findMany` include `user.profile` + `round.course.tees.holes` + `images` + `likes` + `comments.user.profile` cho mỗi post.
- **Impact:** Feed 100 post = 500-1500 query; P95 >2s ở group hoạt động mạnh. Cursor pagination không cứu nổi nested bloat.
- **Fix:** `select` narrow cho card; tách count likes/comments bằng `_count`; lazy-load scorecard tree khi mở detail; batch comments.
- **Estimate:** 2–3md.

### SCALE-02 — [Critical] Leaderboards unbounded
- **Evidence:** `leaderboards.service.ts:31-46` `findMany` orderBy nested, không limit/pagination.
- **Impact:** group 500 player → fetch toàn bộ + nested; O(players²) khi cross-course/season; mobile timeout.
- **Fix:** pagination (cursor) + `@@index` cho sort key; `select` narrow.
- **Estimate:** 1–1.5md.

### SCALE-03 — [High] Courses search ILIKE full-scan
- **Evidence:** `courses.service.ts:323-360` `contains` trên name+address, không FTS/trigram, hardcode `.take(5)`.
- **Impact:** scan 10k+ course mỗi search; `.take(5)` giấu availability, client không phân biệt "5 kết quả" vs "có 5".
- **Fix:** Postgres `pg_trgm` GIN index hoặc tsvector FTS; pagination chuẩn thay `.take(5)`.
- **Estimate:** 1.5–2md.

### SCALE-04 — [High] User search ILIKE không index
- **Evidence:** `users.service.ts:259-267` `contains` first/last name; `schema.prisma` Profile không `@@index(first_name/last_name)`.
- **Impact:** 100k user → full-scan Profile mỗi search; concurrency cao → DB pegged.
- **Fix:** `pg_trgm` GIN index trên name; enforce max limit + cursor.
- **Estimate:** 1.5–2md.

### SCALE-05 — [Medium] Notifications list không pagination
- **Evidence:** `notifications.service.ts:158-177` load all.
- **Impact:** active user tích nghìn row; badge/list O(n).
- **Fix:** cursor pagination + index `(user_id, created_at)`.
- **Estimate:** 0.5md.

### RATE-01 — [High] Không rate-limit / helmet
- **Evidence:** `app.module.ts` không `ThrottlerModule`/helmet; posts/messages/join/complaints không gate.
- **Impact:** spam bulk post, message flood, join+reject cycle, complaint spam; DoS bề mặt.
- **Fix:** `@nestjs/throttler` global + per-endpoint override (write nhạy cảm), helmet. **Đồng bộ với INF high-sev (Phase 5) — gộp 1 lần.**
- **Estimate:** 1.5–2md (net sau overlap Phase 5).

### MOD-01 — [High] Report không apply action + complaint không dedup
- **Evidence:** `reports.service.ts:14-57` chỉ đổi status; `complaints.service.ts:32-69` không dedup/time-window.
- **Impact:** reported content sống mãi (moderation_action không dùng); spam complaint trùng → queue ngập, vụ thật bị chôn.
- **Fix:** apply action (hide post/suspend user) khi resolve; dedup complaint theo `(reporter, target, window)`.
- **Estimate:** 2–3md.

### MOD-02 — [High] Block không enforce ở feed/group
- **Evidence:** block check chỉ ở DM (`chat.service.ts:122-144`, `users.service.ts:314-333`); feed/group reads không loại blocked.
- **Impact:** A block B nhưng post của B vẫn hiện cho A qua feed/group → vector harassment.
- **Fix:** áp `excludedIds` (blocked set) vào posts/feed/group/search reads — helper dùng chung.
- **Estimate:** 1.5–2md.

### WS-01 — [Medium] Memory leak ở activeUsers/notificationTimeouts
- **Evidence:** `chat.service.ts:38-52` Map không evict stale; `:30,561-568` timeout orphan khi drop không `leaveRoom`; passive disconnect (mobile background) không fire `handleDisconnect`.
- **Impact:** Map phình tới 100k+ entry sau nhiều ngày → server bloat → crash.
- **Fix:** TTL eviction + sweep định kỳ; clear timeout on disconnect; heartbeat/idle-timeout.
- **Estimate:** 2–3md.

### WS-02 — [Medium] Reconnect không re-auth
- **Evidence:** `chat.gateway.ts:50-85` cần `authenticate` event nhưng socket.io auto-reconnect không ép re-auth.
- **Impact:** token revoke (logout/ban) → socket vẫn broadcast được.
- **Fix:** verify token mỗi (re)connect; reject socket khi token invalid; refresh trên reconnect.
- **Estimate:** 1–1.5md.

---

## Architecture
- Index strategy: gộp migration với Phase 3 (`pg_trgm` cho search, composite cho sort/list).
- Block-exclusion + pagination helper dùng chung across modules (DRY).
- WS: lifecycle manager (TTL eviction + re-auth) trong `src/websockets/`.
- Rate-limit: throttler global ở Phase 5/10 seam.

## Related Code Files
- Modify: `posts.service.ts`, `leaderboards.service.ts`, `courses.service.ts`, `users.service.ts`, `notifications.service.ts`, `reports.service.ts`, `complaints.service.ts`, `src/websockets/chat.{gateway,service}.ts`
- Modify: `prisma/schema.prisma` (+ trgm/composite index) + migration; `app.module.ts` (throttler/helmet)
- Create: shared block-exclusion + pagination helper

## Implementation Steps
1. Index migration (trgm search + sort/list composite), gộp Phase 3. (trong SCALE-02/03/04)
2. SCALE-01/02: narrow include + `_count` + pagination feed/leaderboard. (3–4.5)
3. SCALE-03/04/05: search FTS/trgm + pagination + max-limit. (3.5–4.5)
4. RATE-01: throttler+helmet (gộp Phase 5). (1.5–2)
5. MOD-01/02: apply moderation action + dedup + block-exclusion helper. (3.5–5)
6. WS-01/02: TTL eviction + re-auth on reconnect. (3–4.5)

## Success Criteria
- [ ] `EXPLAIN` feed/leaderboard/search dùng index, không seq-scan.
- [ ] Feed 100 post phát ≤ ~5 query (đo query log).
- [ ] Search trả pagination chuẩn (không hardcode `.take(5)`).
- [ ] Write endpoint nhạy cảm bị throttle (test vượt ngưỡng → 429).
- [ ] A block B → post B không xuất hiện trong feed/group/search của A (test).
- [ ] Report resolve → content bị hide/user suspend (test).
- [ ] WS Map không tăng vô hạn qua reconnect cycle (soak test); token revoke → socket bị reject.

## Risk Assessment
- Index trên bảng lớn cần `CONCURRENTLY` (đồng bộ Phase 3 maintenance window).
- Block-exclusion áp diện rộng → regression risk feed; rollout có test.
- Throttler ngưỡng sai → chặn nhầm user thật; cần tune + allowlist.

## Estimate
**~14–19md.** Critical perf (SCALE-01/02) + search (03/04) ~6–9md; moderation (MOD-01/02) ~3.5–5md; WS ~3–4.5md; rate-limit ~1.5–2md (net sau overlap Phase 5).

## Assumptions đã chốt (2026-06-19)
- **Search = `pg_trgm`** (GIN index), KHÔNG Elasticsearch — đủ cho ~3k course + 10k-100k user (Q11 resolved). SCALE-03/04 estimate đã giả định pg_trgm.
- **Rate-limit defaults:** global ~100 req/phút/user; write nhạy cảm (post/message/join) ~10/phút; complaint ~5/phút (tune sau theo metric). (Q13)
- **Moderation:** KHÔNG build dashboard riêng cho MVP — apply-action qua admin endpoint sẵn có (MOD-01). Dashboard = post-launch. (Q13)

## Open questions
1. ~~Search pg_trgm vs Elasticsearch?~~ **RESOLVED:** pg_trgm.
2. ~~Moderation dashboard?~~ **RESOLVED:** không cho MVP, apply-action only.
3. ~~Rate-limit ngưỡng?~~ **RESOLVED (assumption):** defaults ở trên, tune theo metric.
