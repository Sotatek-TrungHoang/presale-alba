---
phase: 9
title: "Compliance, Legal & Transactional Comms"
status: pending
priority: P1
effort: "~11–15md"
dependencies: [1]
---

# Phase 9: Compliance, Legal & Transactional Comms

## Overview
Đạt mức tuân thủ **tối thiểu để publish + hợp pháp khi cầm tiền hộ**: account-deletion/erasure thật (hiện chỉ soft-delete), data-export, consent/T&C log, iOS privacy manifest, AML notify-on-fail (Stripe lo phần nặng), và transactional email (receipt/reset). Nguồn: `reports/09-coverage-matrix-uncovered-dimensions.md` #1-6.

> **Vì sao P1, không defer:** (a) Apple App Store + Google Play **bắt buộc** account-deletion + privacy policy mới cho publish → không có = không lên store được. (b) GBP/London ⇒ gần như chắc có user UK/EU ⇒ GDPR áp dụng. (c) Money platform không gửi receipt = rủi ro retention + tranh chấp. **AML nhẹ** vì Stripe Connect tự verify/sàng lọc — Alba chỉ cần notify + audit (đã có `TransactionEventLog`).

## Requirements
- Functional: user xoá được tài khoản + data thật; export được data; consent được log + versioned; payment gửi email receipt.
- Non-functional: erasure không vỡ referential integrity (cascade/anonymize có chủ đích); email idempotent, có retry.

## Findings xử lý

| ID | Sev | Vấn đề | Evidence | Est |
|----|-----|--------|----------|:-:|
| COMP-01 | High | Chỉ soft-delete/anonymize, không erasure thật → fail store + GDPR Art.17 | `users.service.ts:1258-1350`, `schema.prisma` (`deleted_at?` toàn bộ) | 3–5 |
| COMP-02 | High | Không data-export (GDPR Art.20) | không có endpoint | 1.5–2 |
| COMP-03 | Med | Không consent/T&C tracking + versioning (GDPR Art.7) | không có bảng/endpoint | 1.5–2 |
| COMP-04 | Med | Thiếu iOS privacy manifest (PrivacyInfo.xcprivacy) → reject iOS 17+ | `app.config.js` (chỉ có permission strings :29-31) | 0.5–1 |
| COMP-05 | Med | AML: không notify khi Stripe `payouts_enabled=false` / re-onboard | `stripe.service.ts:192-339`, `schema.prisma:667-701` | 1–1.5 |
| EMAIL-01 | High | Không transactional email (receipt/reset fallback) | `firebase.service.ts`, không email provider | 3–4 |

---

## Findings chi tiết

### COMP-01 — [High] Account-deletion là soft-delete, không erasure thật
- **Evidence:** `users.service.ts:1258-1350` — `deleteAccount()` set `deleted_at` + anonymize PII (auth_id→`deleted_*`, email null, push token hard-delete) nhưng **row vẫn nằm DB**; toàn schema dùng `deleted_at?`.
- **Impact:** Apple/Play yêu cầu xoá tài khoản **thật** mới cho publish (mandatory từ 2022). GDPR Art.17 right-to-erasure: anonymize-only thường không đủ nếu không có legal basis lưu vô hạn. → chặn lên store + rủi ro pháp lý.
- **Fix:** Erasure flow có grace-period (vd 30 ngày) → sau đó hard-delete/crypto-erase PII + cascade (hoặc tách bảng PII để erase). Giữ data tài chính theo retention luật (audit) nhưng tách khỏi PII.
- **Estimate:** 3–5md (range do cascade graph 44 model phức tạp).

### COMP-02 — [High] Không có data-export (Subject Access Request)
- **Evidence:** không có `GET /users/me/data-export`.
- **Impact:** GDPR Art.20 portability; user EU có quyền yêu cầu (30 ngày).
- **Fix:** Endpoint export JSON/ZIP: profile, posts, messages, games, transactions của chính user. Async job nếu nặng.
- **Estimate:** 1.5–2md.

### COMP-03 — [Medium] Không consent / T&C versioning
- **Evidence:** không bảng consent_log, không versioning, không audit acceptance.
- **Impact:** không chứng minh user đồng ý T&C/privacy (GDPR Art.7) — rủi ro khi audit/tranh chấp.
- **Fix:** Bảng `consent_log(user_id, doc_type, version, accepted_at)`; gate onboarding ghi nhận acceptance; re-prompt khi version đổi.
- **Estimate:** 1.5–2md.

### COMP-04 — [Medium] Thiếu iOS privacy manifest
- **Evidence:** `app.config.js:29-31` có usage strings nhưng không `PrivacyInfo.xcprivacy`.
- **Impact:** iOS 17+ reject submission nếu thiếu khai báo framework (Firebase/Stripe/Mapbox) + data category.
- **Fix:** Sinh `PrivacyInfo.xcprivacy` + cập nhật store data-collection disclosure.
- **Estimate:** 0.5–1md.

### COMP-05 — [Medium] AML: không notify khi verify fail
- **Evidence:** `stripe.service.ts:192-339` tạo Connect account; `StripeAccount.payouts_enabled` (`schema.prisma:667-701`) chặn payout nhưng không proactive notify/re-onboard.
- **Impact:** organizer bị Stripe block payout mà không biết → tiền kẹt, support load. (AML verify nặng đã do Stripe lo.)
- **Fix:** Webhook `account.updated` → nếu `payouts_enabled=false`/`requirements` → notify + deep-link re-onboard.
- **Estimate:** 1–1.5md.

### EMAIL-01 — [High] Không có transactional email
- **Evidence:** chỉ Firebase auth (`firebase.service.ts`); không email provider; payment success không gửi receipt; reset password = Firebase client-side.
- **Impact:** Money platform không gửi receipt/confirm; nếu user tắt push → mất mọi delivery (không email/SMS fallback). Ảnh hưởng tranh chấp + retention.
- **Fix:** Tích hợp SendGrid/AWS SES: receipt sau payment, payout notice, complaint-resolution; fallback cho notification quan trọng. Template + retry + idempotency.
- **Estimate:** 3–4md.

---

## Deferred to post-launch backlog (theo quyết định scope)
- **Accessibility (a11y)** mobile (`reports/09` #11) — 95% component thiếu screen-reader. Defer; ghi nhận ~5-7md khi làm.
- **i18n / l10n** (`reports/09` #12) — English-only launch. Defer; ~6-10md khi mở thị trường khác.
- (Timezone KHÔNG defer — là correctness, ở Phase 11.)

## Architecture
- Tách PII khỏi data tài chính để erasure không vỡ audit (COMP-01).
- Email service như module riêng (`src/email/`) provider-agnostic, dùng lại cho notification fallback (EMAIL-01 + COMP-05).
- Consent như cross-cutting onboarding gate (COMP-03).

## Related Code Files
- Modify: `src/users/users.service.ts` (erasure), `prisma/schema.prisma` (+ consent_log, tách PII) + migration
- Create: `src/email/*` (provider + templates), `src/users/data-export.*`, privacy manifest asset (mobile)
- Modify: `src/stripe/*` (account.updated → notify), mobile re-onboard deep-link

## Implementation Steps
1. EMAIL-01: dựng email module + receipt/reset templates (nền cho COMP-05 fallback). (3–4)
2. COMP-01: thiết kế erasure + grace-period + cascade/crypto-erase; migration tách PII. (3–5)
3. COMP-02: data-export endpoint (async nếu nặng). (1.5–2)
4. COMP-03: consent_log + onboarding gate + re-prompt. (1.5–2)
5. COMP-05: webhook account.updated → notify/re-onboard. (1–1.5)
6. COMP-04: sinh privacy manifest + store disclosure. (0.5–1)

## Success Criteria
- [ ] User xoá tài khoản → PII bị hard-erase sau grace-period (test); data tài chính giữ tách biệt.
- [ ] `GET /users/me/data-export` trả đủ data của chính user.
- [ ] Consent được ghi + version; đổi version → re-prompt.
- [ ] Payment success gửi email receipt (test với provider sandbox).
- [ ] Stripe `payouts_enabled=false` → user nhận notify + re-onboard link.
- [ ] iOS build pass privacy-manifest check.

## Risk Assessment
- Erasure cascade trên 44 model dễ vỡ referential → cần test kỹ + grace-period rollback (range estimate rộng vì lý do này).
- Email provider cần domain/DKIM/SPF setup (devops phối Phase 5).
- Phụ thuộc Phase 1: erasure đụng money/PII → sau khi security blockers xong.

## Estimate
**~11–15md.** Core store-mandatory (COMP-01/02/04 + EMAIL-01) ~8–12md; phần GDPR-đầy-đủ (COMP-03) + AML notify (COMP-05) ~3md.

## Assumptions đã chốt (2026-06-19, cần khách xác nhận lần cuối)
- **Market UK/EU in-scope** → COMP-01..05 + EMAIL-01 full (GDPR đầy đủ), không defer.
- **Retention data tài chính = 6 năm** (chuẩn HMRC/UK) → erasure (COMP-01) tách PII khỏi `Transaction` ledger; giữ ledger ẩn danh 6 năm rồi mới purge. Quyết định này định hình schema tách PII.
- **Email provider = SendGrid** (EMAIL-01) — có thể đổi SES/Resend, ảnh hưởng nhỏ.

## Open questions
1. ~~Market UK/EU?~~ **RESOLVED:** UK/EU in-scope.
2. ~~Retention tài chính?~~ **RESOLVED (assumption):** 6 năm HMRC. Khách xác nhận con số chính xác theo legal.
3. ~~Email provider?~~ **RESOLVED (assumption):** SendGrid.
