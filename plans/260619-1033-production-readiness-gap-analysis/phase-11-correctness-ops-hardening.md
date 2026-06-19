---
phase: 11
title: "Correctness & Operational Hardening"
status: pending
priority: P1
effort: "~12–18md"
dependencies: [5]
---

# Phase 11: Correctness & Operational Hardening

## Overview
Sửa các vấn đề **đúng-sai + vận hành** không phụ thuộc scope thị trường/scale: timezone bug rải rác, dependency CVE, nợ versioning v1, observability depth, DR/S3 lifecycle, UX completeness. Nguồn: `reports/09-coverage-matrix-uncovered-dimensions.md` #7,8,9,10,13,14.

> **Vì sao P1:** TZ là **bug correctness thật** (sai ngày game ở ranh giới); CVE là **security/supply-chain**; observability/DR là tiền đề vận hành prod. Đây là phần đáng ra phải có nhưng audit 7-chiều ban đầu hoà tan/bỏ sót.

## Requirements
- Functional: so sánh/hiển thị ngày game đúng theo London tz nhất quán; report/metric/health quan sát được.
- Non-functional: 0 CVE high còn open; v1 có quyết định sunset/giữ; S3 có lifecycle.

## Findings xử lý

| ID | Sev | Vấn đề | Evidence | Est |
|----|-----|--------|----------|:-:|
| TZ-01 | High | TZ rải rác: chỉ `completeGame` dùng London, 40+ chỗ `new Date().setHours()` theo server TZ; mobile theo device | `games.service.ts:778-790` vs `:1827,:1551,:947`; mobile `formatters.ts:21` | 2–3 |
| DEP-01 | High | 16+ CVE (gRPC, babel, js-yaml, OTel, Sentry transitive; mobile form-data/fast-uri) — **patch-only, không major upgrade** | `npm audit` cả 2 repo | 2 |
| VER-01 | Med | `v1/games` dead code (mobile 0 reference) → **sunset/remove** | `v1/games/*`, `v1.module.ts`; mobile `api/` grep 0 hit | 1 |
| OBS-01 | Med | Chỉ Sentry; không structured log/metrics/health-readiness/SLO | `shared/sentry.config.ts`, Logger 6 file | 2–3 |
| DR-01 | Med | Backup thủ công; S3 không lifecycle/CDN; processed image không cleanup | `dump-prod-to-dev.sh`, `images.service.ts` | 1.5–2 |
| UX-01 | Med | Thiếu skeleton/offline-queue/retry/deep-link-validation | `search/index.tsx:264-373`, `useChatSocket.ts:137-144`, `+not-found.tsx` | 2–3 |

---

## Findings chi tiết

### TZ-01 — [High] Timezone handling rải rác & không nhất quán
- **Evidence:** chỉ `games.service.ts:778-790` (`completeGame`) dùng `Intl.DateTimeFormat(..., {timeZone:'Europe/London'})`; nhưng `:1827-1838` (suggested), `:1551` (myGames), `:947-967` (filter) dùng `new Date().setHours()` theo server TZ; mobile `formatters.ts:21` `toLocaleDateString(undefined)` theo device.
- **Impact:** off-by-one-day ở ranh giới ngày: game "tomorrow London" bị filter sai / hiển thị sai cho user khác timezone; vỡ nếu server đổi TZ. Đây là **bug đúng-sai**, không phải i18n.
- **Fix:** chuẩn hoá `date-fns-tz` (hoặc tương đương) 1 nguồn London tz cho mọi so sánh/hiển thị ngày game; backend lưu UTC, convert ở boundary; mobile hiển thị London tz cho game date.
- **Estimate:** 2–3md.

### DEP-01 — [High] Dependency CVE chưa vá
- **Evidence:** `npm audit` backend: NestJS core ≤ vuln floor, `@grpc/grpc-js`, `@babel/core`, `js-yaml`, OTel, Sentry transitive; mobile: `form-data` CRLF, `fast-uri` path-traversal (HIGH).
- **Impact:** RCE/DoS/data-exfil bề mặt; không có remediation process.
- **Fix:** `npm audit fix` + nâng dep trong floor an toàn (**KHÔNG NestJS major 10→11 — khách chốt patch-only**). Thêm CI `npm audit` gate (phối Phase 5).
- **Estimate:** 2md (patch-only, không major migrate).

### VER-01 — [Medium] `v1/games` dead code → sunset
- **Evidence:** `v1/games` 319 LOC thiếu notification/payout vs `games` 2200 LOC; `v1.module.ts`. **Verified:** mobile `api/` grep `v1` = 0 hit → không client nào gọi.
- **Impact:** dead code tăng surface bảo trì + nhầm lẫn canonical; nhưng KHÔNG có client phụ thuộc → an toàn xoá.
- **Fix:** remove `src/v1/` + unmount khỏi `app.module.ts`; verify smoke không endpoint nào 404 ngoài ý muốn. (Nếu sau phát hiện web/third-party client dùng v1 → đổi sang consolidate, +1-2md.)
- **Estimate:** 1md.

### OBS-01 — [Medium] Observability nông
- **Evidence:** chỉ Sentry (`shared/sentry.config.ts`); Logger ở 6 file; không request log / metrics / health-readiness (chỉ stripe webhook health) / SLO.
- **Impact:** ops mù — latency/throughput/SLO không đo; alert chỉ error-level.
- **Fix:** structured request logging (interceptor), `/health` + `/ready` (Terminus), metrics cơ bản (Prometheus optional), alert rule. Phối graceful-shutdown (INF-02 Phase 1).
- **Estimate:** 2–3md.

### DR-01 — [Medium] DR / S3 lifecycle
- **Evidence:** `dump-prod-to-dev.sh` backup thủ công; `images.service.ts` presign S3 không lifecycle/CDN; processed image không cleanup.
- **Impact:** S3 phình chi phí; RTO/RPO không xác định; không CDN → latency ảnh.
- **Fix:** automate backup + retention; S3 lifecycle policy + cleanup orphan; CDN (CloudFront) cho media. Document RTO/RPO.
- **Estimate:** 1.5–2md.

### UX-01 — [Medium] UX completeness
- **Evidence:** loading/error/empty cơ bản có (`search/index.tsx:264-373`) nhưng thiếu skeleton, offline-queue (`useChatSocket.ts:137-144` chỉ alert), retry button, deep-link validation (`+not-found.tsx` only).
- **Impact:** outage/mất kết nối không recover graceful; deep-link ID sai crash/silent.
- **Fix:** skeleton loader, offline detection + queue/retry UI, "reconnecting" state, validate deep-link params.
- **Estimate:** 2–3md.

---

## Architecture
- TZ: 1 util `date-fns-tz` dùng chung BE+mobile (DRY); lưu UTC, convert ở edge.
- OBS: interceptor logging + Terminus health, độc lập business code.
- CDN/S3 lifecycle: devops (phối Phase 5).

## Related Code Files
- Modify: `games.service.ts` + mobile `formatters.ts` (TZ); `package.json` cả 2 repo (DEP); `v1/*` (VER); `main.ts`/interceptor + health controller (OBS); `images.service.ts` + infra (DR); mobile screens (UX)
- Create: `src/shared/date-tz.util.ts`, health module, logging interceptor

## Implementation Steps
1. TZ-01: util tz dùng chung; refactor 40+ call-site so sánh ngày; mobile hiển thị London. (2–3)
2. DEP-01: audit fix + nâng dep; đánh giá NestJS major riêng; CI audit gate. (2–4)
3. OBS-01: logging interceptor + health/ready + alert. (2–3)
4. VER-01: quyết sunset/consolidate v1 + deprecation. (2–3)
5. DR-01: automate backup + S3 lifecycle + CDN. (1.5–2)
6. UX-01: skeleton/offline/retry/deep-link. (2–3)

## Success Criteria
- [ ] Game date so sánh/hiển thị nhất quán London tz qua mọi path (test boundary-day + đổi server TZ).
- [ ] `npm audit` cả 2 repo: 0 high open; CI gate chặn dep vuln mới.
- [ ] `/health` + `/ready` trả đúng; request log có trace id.
- [ ] v1: có quyết định + deprecation header (hoặc consolidated).
- [ ] S3 lifecycle policy active; backup tự động + RTO/RPO documented.
- [ ] Mobile: offline → queue/retry; deep-link ID sai → graceful.

## Risk Assessment
- TZ refactor 40+ chỗ → regression filter game; cần test boundary kỹ.
- NestJS major upgrade (nếu chọn) breaking → range estimate rộng; cân nhắc patch-only.
- v1 sunset cần biết client production còn dùng không (Open Q).

## Estimate
**~11–14md** (revised sau khách chốt: DEP patch-only 2md, VER sunset 1md). TZ ~2–3md; DEP 2md; OBS ~2–3md; VER 1md; DR ~1.5–2md; UX ~2–3md.

## Open questions
1. ~~NestJS major upgrade?~~ **RESOLVED:** patch-only, không major (khách chốt 2026-06-19).
2. ~~Client nào gọi `/v1/games`?~~ **RESOLVED:** mobile 0 reference → sunset/remove (verified grep). Risk: nếu có client ẩn khác → +1-2md.
3. CDN provider (CloudFront/Cloudflare) + budget DR?
