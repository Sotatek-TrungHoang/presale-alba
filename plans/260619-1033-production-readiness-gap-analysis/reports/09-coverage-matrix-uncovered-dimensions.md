# Alba — Coverage Matrix: Uncovered Dimensions (Prompt A sweep)

**Date:** 2026-06-19
**Method:** 4 sub-agent đọc source thật, đối chiếu plan 7-dimension + Phase 8 (games perf). Mỗi dòng có `file:line`. KHÔNG estimate ở đây (estimate ở phase-09/10/11).
**Mục đích:** chống "estimate sai/thiếu do bỏ sót dimension". Đây là **độ phủ**, không phải finding chi tiết.

> Coverage: ✅ đã cover · ◐ một phần / hoà tan vào dimension khác · ❌ chưa cover.

## Coverage matrix

| # | Dimension | Cover | Bằng chứng (file:line) | Rủi ro thật |
|---|-----------|:--:|------------------------|-------------|
| 1 | **GDPR / right-to-erasure** | ◐ | `users.service.ts:1258-1350` chỉ soft-delete + anonymize; toàn schema `deleted_at?`; KHÔNG hard-delete/crypto-erase | Apple/Play yêu cầu xoá tài khoản thật để publish; GDPR Art.17 |
| 2 | **Consent / T&C tracking** | ❌ | Không có bảng consent_log, không versioning T&C, không endpoint | GDPR Art.7; không chứng minh được user đồng ý |
| 3 | **Data export (SAR)** | ❌ | Không có `GET /users/me/data-export` | GDPR Art.20 right-to-portability |
| 4 | **AML / KYC** | ◐ | Stripe Connect lo verify (`stripe.service.ts:192-339`); `StripeAccount` có `payouts_enabled` (`schema.prisma:667-701`); audit trail có (`TransactionEventLog:790-807`) | NHẸ — chỉ thiếu notify khi verify fail + re-onboard prompt |
| 5 | **App Store / Play readiness** | ◐ | Permission strings có (`app.config.js:29-31`); **thiếu iOS PrivacyInfo.xcprivacy**; không IAP-conflict (Stripe-only OK) | iOS 17+ reject nếu thiếu privacy manifest |
| 6 | **Transactional email** | ❌ | Chỉ Firebase auth (`firebase.service.ts`); không email service; receipt = 0; reset = Firebase client-side | Money platform không gửi receipt/confirm; mất delivery khi user tắt push |
| 7 | **Observability depth** | ◐ | Chỉ Sentry (`shared/sentry.config.ts`); Logger ở 6 file; không structured request log / metrics / health-readiness / SLO | Ops mù: latency/SLO không đo được, alert chỉ error |
| 8 | **Data lifecycle / DR** | ◐ | Backup script thủ công (`dump-prod-to-dev.sh`); S3 presign (`images.service.ts`) không lifecycle/CDN; processed image không cleanup | S3 phình chi phí; RTO/RPO không xác định |
| 9 | **Dependency / supply-chain** | ❌ | `npm audit`: NestJS core ≤ vuln floor, gRPC, babel, js-yaml, OTel, Sentry transitive; mobile form-data/fast-uri HIGH | 16+ CVE chưa vá; RCE/DoS bề mặt |
| 10 | **API versioning debt** | ❌ | `v1/games` (319 LOC) vs `games` (2200 LOC); v1 thiếu notification/payout; canonical = `/games`; không deprecation | Client v1 thiếu 3+ feature; remove = vỡ client |
| 11 | **Accessibility (a11y)** | ❌ | 3/57 component có `accessibilityLabel` (`SearchInput/CourseSheetModal/BookingConfirmationModal`); không font-scaling/hit-target | 95% component vô hình với screen-reader → **DEFER theo quyết định** |
| 12 | **i18n / l10n** | ❌ | Không i18n lib; hardcode English (`Filters.tsx:46-73`…); GBP hardcode; `toLocaleString(undefined)` theo device | English-only → **DEFER theo quyết định** |
| 13 | **UX completeness** | ◐ | Có loading/error/empty cơ bản (`search/index.tsx:264-373`, `chats/index.tsx:31-69`); thiếu skeleton/offline-queue/retry/deep-link-validation | Outage/mất kết nối không recover graceful |
| 14 | **Timezone correctness** | ❌ | Chỉ `completeGame` dùng `Europe/London` (`games.service.ts:778-790`); 40+ chỗ khác `new Date().setHours()` theo server TZ (`:1827`, `:1551`, `:947`); mobile theo device | **Bug thật**: off-by-one-day ở ranh giới ngày / khi đổi server TZ |
| 15 | **Performance — Posts/Feed** | ❌ | `posts.service.ts:126-184` include cây sâu (profile, round.course.tees.holes, likes, comments.user.profile) | N+1: 100 post → 500-1500 query |
| 16 | **Performance — Leaderboards** | ❌ | `leaderboards.service.ts:31-46` `findMany` unbounded + nested | O(players²), fetch toàn bộ |
| 17 | **Performance — Notifications list** | ◐ | `notifications.service.ts:158-177` không pagination | Active user tích nghìn row, O(n) scan |
| 18 | **Search — User (ILIKE full-scan)** | ❌ | `users.service.ts:259-267` `contains` không index; Profile không `@@index(first/last_name)` | 100k user → full-scan mỗi search |
| 19 | **Search — Courses** | ❌ | `courses.service.ts:323-360` ILIKE + hardcode `.take(5)`, không FTS/trigram | Scan 10k+ course mỗi query |
| 20 | **Rate-limiting / anti-spam** | ❌ | Không throttler/helmet ở `app.module.ts`; posts/messages/join/complaints không gate | Spam/DoS/flood không phòng |
| 21 | **Moderation action application** | ❌ | `reports.service.ts:14-57` chỉ log status, không apply action; complaints không dedup (`complaints.service.ts:32-69`) | Reported content sống mãi; queue ngập |
| 22 | **Block enforcement bidirectional** | ◐ | Block check ở DM (`chat.service.ts:122-144`, `users.service.ts:314-333`) nhưng **không ở feed/group** | A block B, B post vẫn hiện cho A qua feed |
| 23 | **WebSocket scale** | ◐ | Room cleanup có (`chat.gateway.ts:42-48`) nhưng `activeUsers`/`notificationTimeouts` Map không evict; passive disconnect không fire; reconnect không re-auth | Memory leak nhiều ngày; banned user vẫn gửi |

## Đã verify CLEAN (không cần làm)
- ✅ Block check ở DM bidirectional (`chat.service.ts:122-144`).
- ✅ WS room cleanup + socket.io listener lifecycle chuẩn (`chat.gateway.ts:42-48`).
- ✅ AML phần lớn do Stripe Connect lo (chỉ thiếu notify-on-fail).
- ✅ Complaint authorization (chỉ approved player được file) + audit trail.
- ✅ Permission usage strings iOS đã có (`app.config.js:29-31`).

## Phân bổ vào phase mới
- **Phase 9 — Compliance, Legal & Comms:** #1,2,3,4,5,6 (+ #11/12 ghi backlog defer).
- **Phase 10 — Platform Performance & Scale:** #15,16,17,18,19,20,21,22,23.
- **Phase 11 — Correctness & Ops Hardening:** #7,8,9,10,13,14.

## Open questions (đẩy về khách / assumption)
1. Market UK/EU xác nhận? (quyết depth Phase 9 — đang assume compliance-min IN vì store-mandatory).
2. Có sunset `/v1/games` hay giữ song song? (VER, Phase 11).
3. Dependency: cho phép upgrade NestJS major (10→11) hay chỉ patch trong floor? (DEP, ảnh hưởng range Phase 11).
4. a11y/i18n confirm defer post-launch? (đang assume defer).
