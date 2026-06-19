# 07 — Mobile App Health & Mobile↔Backend Integration Contract Audit

Auditor dimension: React Native/Expo production-readiness + API contract alignment.
Mobile: `alba-golf-rn-main` · Backend: `alba-social-backend-main` (NestJS).
All findings verified against opened source. Backend has **no global prefix** (`src/main.ts:43` listens on `:3000` with no `setGlobalPrefix`), so mobile `EXPO_PUBLIC_API_URL` must point at the bare host.

## Summary Table

| Sev | ID | Title | Est (md) |
|-----|----|-------|----------|
| Critical | MOB-01 | `EVENING` time slot selectable but rejected by `POST /games` DTO | 0.5 |
| Critical | MOB-02 | No 401 / token-refresh response handling — stale-token requests fail with no recovery | 1.5 |
| Critical | MOB-03 | No global ErrorBoundary — any render throw white-screens the app | 1.0 |
| High | MOB-04 | `fetchStripePublishableKey` ships hardcoded fallback test key → live payments init with wrong/test key | 0.5 |
| High | MOB-05 | `UpdatePlayerStatusDto` mobile allows `CONFIRMED`; backend route rejects it | 0.5 |
| High | MOB-06 | `eas.json` has no `env` blocks; Firebase/Stripe/API keys un-injected → silent prod breakage | 1.0 |
| High | MOB-07 | Facebook appID + clientToken hardcoded as fallbacks in `app.config.js` | 0.25 |
| Medium | MOB-08 | `UserProfileDto` type declares `firstName/lastName` (camelCase) vs backend snake_case | 0.5 |
| Medium | MOB-09 | No offline / NetInfo handling; chat-only "Connecting…" UX | 1.0 |
| Medium | MOB-10 | No list pagination anywhere (games/golfers/conversations) | 2.0 |
| Medium | MOB-11 | Duplicate axios client + token logic copy-pasted across 6+ api files | 1.0 |
| Low | MOB-12 | Moderation "User Management" is a "Coming Soon" stub | 0.5 |
| Low | MOB-13 | `JoinRequestCard` distance hardcoded `"Xkm away"` placeholder | 0.25 |
| Low | MOB-14 | Several files >600 LOC (personal-info 925, onboarding step6/7) | 2.0 |
| Low | MOB-15 | `USE_MOCK_DATA` mock paths still bundled (courses/location) | 0.25 |

**Total: ~13.5 man-days**

---

## Findings

### MOB-01 — [Critical] `EVENING` time slot selectable but rejected by `POST /games`
- Mobile: `app/(app)/create-round/select-time-slot.tsx:31-35` offers `id: "EVENING"` as a selectable option. Selected value is cast and POSTed: `app/(app)/create-round/review-round-details.tsx:109` → `time_slot: timeSlot as createGameDto["time_slot"]` → `createGame()` (`api/games.ts:91-99`).
- Mobile type `createGameDto.time_slot` (`api/games.ts:10`) only lists 4 values (no EVENING) — the `as` cast hides the mismatch at compile time.
- Backend: main `CreateGameDto` (`src/games/dto/create-game.dto.ts`, time_slot enum) restricts to `EARLY_MORNING|LATE_MORNING|LUNCHTIME|LATE_AFTERNOON` — **EVENING absent** (only Prisma `TimeSlot` `schema.prisma:615-637` and `src/v1/games` allow EVENING, but mobile calls the non-v1 `/games`).
- **Impact:** User picking "Evening" → `POST /games` 400 validation error → round creation fails. Core flow broken.
- **Fix:** Either remove EVENING option from `select-time-slot.tsx`, or add EVENING to backend main `CreateGameDto`/`UpdateGameStatusDto` enums. Align with product intent. Add EVENING to mobile `createGameDto` type to surface drift.
- **Estimate:** 0.5 md

### MOB-02 — [Critical] No 401 / token-refresh response handling
- Every api file builds `axios.create(DEFAULT_CONFIG)` with a **request** interceptor that attaches `Bearer ${idToken}` via `getIdToken(currentUser, false)` (no force-refresh): `api/games.ts:70-89`, `api/stripe.ts:89-108`, `api/user.ts:141-152`, `api/chat.ts:50-72`, `api/conversations.ts:86-105`.
- There is **no response interceptor** anywhere. Grep for `interceptors.response` / `status === 401` returns only `hooks/useGameActions.ts:112` (a 409 check). Confirmed absent across `api/`, `hooks/`, `providers/`.
- `getIdToken(user, false)` returns a cached token; Firebase auto-refreshes most of the time, but on clock skew / revoked session / backend `FirebaseAuthGuard` rejection the request 401s and the app neither force-refreshes the token nor routes to login.
- **Impact:** Intermittent "silent" auth failures in prod with no recovery path; user stuck on errored screens.
- **Fix:** Add a shared axios instance with a response interceptor: on 401, `getIdToken(user, true)` (force refresh) + retry once; on repeated 401 call `logout()`. Consolidate into one client (see MOB-11).
- **Estimate:** 1.5 md

### MOB-03 — [Critical] No global ErrorBoundary
- Grep for `ErrorBoundary` / `componentDidCatch` across `app/` + `components/` returns nothing. `app/_layout.tsx` wraps the tree in providers + `Sentry.wrap` (`_layout.tsx:153`) but Sentry.wrap reports the crash; it does not render a fallback UI.
- **Impact:** Any uncaught render error (e.g., a null `game.course` in `transformGameData`, malformed API payload) white-screens the entire app with no recovery.
- **Fix:** Add an Expo Router `ErrorBoundary` export (or a top-level error boundary component) with a "Something went wrong / retry" fallback.
- **Estimate:** 1.0 md

### MOB-04 — [High] Hardcoded Stripe fallback key shipped
- `api/stripe.ts:356-376`: `fetchStripePublishableKey` returns `process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`; on any backend error it `return "pk_test_51234567890abcdef"` (a fake/test key) and only logs a warning.
- `app/_layout.tsx:170-182,210-221` initializes `StripeProvider` with whatever this returns.
- **Impact:** If env var is missing or `/stripe/publishable-key` (`src/stripe/stripe.controller.ts:242`) fails, the app initializes Stripe with an invalid key → all payment sheets break in production with a cryptic error instead of failing loud.
- **Fix:** Remove the hardcoded fallback. If no key, disable payment UI and surface a clear error; do not boot Stripe with a bogus key.
- **Estimate:** 0.5 md

### MOB-05 — [High] Player-status `CONFIRMED` not accepted by backend
- Mobile: `api/games.ts:207-209` `UpdatePlayerStatusDto.status: "APPROVED" | "REJECTED" | "CONFIRMED"`. Sent via `updatePlayerStatusInGame` → `PATCH /games/:gameId/players/:playerId` (`api/games.ts:212-230`), called from `hooks/useGameActions.ts:32-33`.
- Backend: `UpdatePlayerStatusDto` (`src/games/dto/update-player-status.dto.ts:5-6`) enum is **only** `['APPROVED','REJECTED']`. Route `src/games/games.controller.ts:135-148`.
- **Note:** Verified that `useGameActions` currently only passes APPROVED/REJECTED from the approve/reject UI, so today's path works. But the mobile type advertises CONFIRMED — any future caller (or refactor) sending CONFIRMED to this route 400s. The `"CONFIRMED"` literals elsewhere (`review-round-details.tsx:174`, `useGameDetail.ts:110`, card components) are **local display state**, not this API call — not breaks.
- **Impact:** Latent contract trap; status enum drift between client/server.
- **Fix:** Decide whether CONFIRMED is a server-side state transition (e.g., after payment). If so add it to backend DTO + service; otherwise remove from mobile `UpdatePlayerStatusDto`.
- **Estimate:** 0.5 md

### MOB-06 — [High] `eas.json` injects no env vars
- `eas.json` profiles (`development-tf`, `preview`, `production`) set `environment`/`channel` but contain **no `env` block** (whole file, 55 lines). Firebase config (`firebase.config.js:6-12`) and `API_BASE_URL` (`api/config.ts:9`) depend entirely on `EXPO_PUBLIC_*` with empty-string/undefined fallbacks. No `.env*` file present in repo (verified).
- `API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || ""` → if unset, `buildApiUrl` produces `"/games"` (relative) → all requests fail.
- **Impact:** Builds rely on EAS dashboard env vars / EAS "environment" secrets being correctly configured per channel. If any is missing the prod build silently breaks auth or all API calls. High operational risk, undocumented.
- **Fix:** Either declare `env` per profile in `eas.json` (referencing EAS secrets) or document the required EAS environment variables and add a startup assertion that `API_BASE_URL` and Firebase keys are non-empty.
- **Estimate:** 1.0 md

### MOB-07 — [High] Hardcoded Facebook credentials in `app.config.js`
- `app.config.js:1-2`: `facebookAppId ?? "27422359920777607"`, `facebookClientToken ?? "160d51adc0a621e8873feb50ac875ad4"`; `:3` Reddit SKAdNetwork id; `:94` Google iOS URL scheme fallback. These ship in the bundle.
- **Impact:** Real Facebook clientToken committed to source. While the FB clientToken is semi-public, committing it (and the prod appID) is a leak and couples builds to one app config. Treat as a shipped credential.
- **Fix:** Require env vars; drop the hardcoded fallbacks (fail build if missing for prod profile). Rotate the exposed clientToken if it is the production one.
- **Estimate:** 0.25 md

### MOB-08 — [Medium] `UserProfileDto` field-name drift (type vs runtime)
- Mobile type `UserProfileDto` (`api/user.ts:76-85`) declares `firstName?`, `lastName?` (camelCase).
- Backend `PATCH /profiles/user-profile` (`src/profiles/profiles.controller.ts:56`) expects `UserProfileDto` with `first_name`, `last_name` (snake_case).
- The actual caller `app/(app)/edit-profile/index.tsx:231-240` builds an **untyped inline object** with `first_name`/`last_name` (snake_case) → runtime works. So the exported type is wrong/misleading but current screen happens to send correct keys.
- **Impact:** Type is unsafe; a TS-trusting future caller sending `firstName` would silently drop the name update (backend ignores unknown field). Latent data-loss bug.
- **Fix:** Correct `UserProfileDto` to snake_case to match backend; type the `profileUpdateData` object so drift is caught.
- **Estimate:** 0.5 md

### MOB-09 — [Medium] No offline / network-state handling
- No `NetInfo` / `isConnected` usage outside chat sockets (`hooks/useChatSocket.ts`, `useGameChatSocket.ts`; chat screen shows "Connecting…" `chat/[conversationId].tsx:314-325`). No NetInfo import anywhere for REST flows.
- **Impact:** Offline → axios throws after 10s timeout (`config.ts:17`), surfaced as generic alerts; no offline banner, no retry, no queue.
- **Fix:** Add `@react-native-community/netinfo` listener + offline banner; gate write actions when offline.
- **Estimate:** 1.0 md

### MOB-10 — [Medium] No pagination on lists
- Grep `onEndReached` / `cursor` / `useInfinite` across `app/` + `hooks/` returns nothing. Backend DOES support cursors on `GET /users/home-feed` and `/users/:id/feed` (`cursor,limit` — users.controller.ts:74,131), but mobile doesn't use them. `getNearbyGames`/`getSuggestedGames`/`getUserConversations` fetch full arrays.
- **Impact:** Unbounded payloads as data grows → slow lists, memory pressure, jank on low-end devices.
- **Fix:** Adopt cursor pagination (FlatList `onEndReached`) for feed, games, golfers, conversations.
- **Estimate:** 2.0 md

### MOB-11 — [Medium] Duplicated axios client + token logic
- Identical `getFirebaseAuthToken` + `axios.create` + request interceptor copy-pasted in `api/games.ts`, `stripe.ts`, `user.ts`, `chat.ts`, `conversations.ts` (and more). `chat.ts:57-66` even has a subtly different behavior (swallows token error instead of throwing).
- **Impact:** Inconsistent behavior; fixing MOB-02 (401 handling) requires editing every file. Maintenance hazard.
- **Fix:** Extract a single shared `apiClient` (e.g., `api/client.ts`) with both interceptors; import everywhere.
- **Estimate:** 1.0 md

### MOB-12 — [Low] Moderation "User Management" stub
- `app/(app)/moderation/dashboard.tsx:173-175`: `Alert.alert('Coming Soon', 'User management features will be available in a future update.')`.
- **Impact:** Shipped unfinished feature surfaced in UI. Acceptable if hidden behind admin role; otherwise remove the card for GA.
- **Estimate:** 0.5 md

### MOB-13 — [Low] `JoinRequestCard` hardcoded distance
- `components/ui/JoinRequestCard.tsx:55`: `const distanceAway = "Xkm away"; // Placeholder - needs data source`.
- **Impact:** Literal "Xkm away" rendered to users.
- **Fix:** Wire real distance or hide the field.
- **Estimate:** 0.25 md

### MOB-14 — [Low] Oversized files
- `app/(app)/stripe-onboarding/personal-info.tsx` 925 LOC; `onboarding/step6.tsx` 783; `step7.tsx` 713; `edit-profile/index.tsx` 644; `chat/[conversationId].tsx` 639; `onboarding/step5.tsx` 612; `login.tsx` 602; `providers/Auth.tsx` 560.
- **Impact:** Hard to maintain/test; exceeds 200-LOC project guideline.
- **Fix:** Extract forms/sections into sub-components and hooks.
- **Estimate:** 2.0 md

### MOB-15 — [Low] Mock-data paths still bundled
- `api/config.ts:24` `USE_MOCK_DATA = false` (good), but mock branches remain in `api/courses.ts:36` and silent mock fallbacks in `api/location.ts:38,87` (returns mock address on error).
- **Impact:** `location.ts` returns fabricated data on geocode failure → misleading UX, not gated by the flag.
- **Fix:** Remove mock fallbacks from `location.ts`; surface errors instead.
- **Estimate:** 0.25 md

---

## Contract-Mismatch Matrix

| Endpoint (mobile call) | Mobile (file:line) | Backend (file:line) | Drift |
|---|---|---|---|
| `POST /games` time_slot=EVENING | `select-time-slot.tsx:31`→`review-round-details.tsx:109` | `create-game.dto.ts` (4-value enum) | **EVENING rejected** (MOB-01) |
| `PATCH /games/:id/players/:playerId` | `api/games.ts:207` (`+CONFIRMED`) | `update-player-status.dto.ts:5` (`APPROVED|REJECTED`) | CONFIRMED not accepted (MOB-05) |
| `PATCH /profiles/user-profile` | `api/user.ts:77` type `firstName` | `profiles.controller.ts:56` `first_name` | type camelCase vs snake (runtime ok) (MOB-08) |
| `POST /games`, `/games/join`, `/games/my-games`, `/games/:id/confirm`, `/games/:id/payment`, `/games/:id/payment-details`, `/games/:id/complete` | `api/games.ts` | `games.controller.ts:33,39,90,167,246,221,182` | **Match** ✓ |
| `GET /games/nearby` / `/suggested` | `api/games.ts:119,171` | `games.controller.ts:44,67` | Match ✓ (suggested also accepts `q`,`limit` unused) |
| `POST /users/signup-with-onboarding` | `api/user.ts:259` | `users.controller.ts:43` | Match ✓ |
| `GET /users/me`, `DELETE /users/me` | `api/user.ts:161,188` | `users.controller.ts:55,62` | Match ✓ |
| `PATCH /users/location` | `api/user.ts:318` `{lat,lng}` | `users.controller.ts:175` `UpdateUserLocationDto` | Match ✓ |
| Stripe onboarding (initiate/status/account/external-account/individual/document/requirements) | `api/stripe.ts:139,171,202,223,259,303,327` | `stripe.controller.ts:38,67,94,129,179,204,157` | Match ✓ |
| `GET /stripe/publishable-key` | `api/stripe.ts:367` | `stripe.controller.ts:242` | Match ✓ (but bogus fallback MOB-04) |
| `POST /conversations/get-or-create` `{profileId}` | `api/conversations.ts:116` | `conversations.controller.ts:26` (`profileId?`,`gameId?`) | Match ✓ |
| `GET /conversations/:userId` | `api/conversations.ts:160` | `conversations.controller.ts:38` | Match ✓ |
| `GET /conversations/:id/messages` | `api/chat.ts:83`, `conversations.ts:138` | `conversations.controller.ts:44` | Match ✓ |
| Send message (HTTP) | none — WS only (`useChatSocket.ts`) | `POST /messages` (`messages.controller.ts:11`) exists but HTTP path unused | By design (WebSocket); no mark-read endpoint exists either |

**Verified contract mismatches that fail/misbehave in prod: 2 (MOB-01 Critical, MOB-05 High) + 1 type-level (MOB-08).** All other audited endpoints align.

---

## Release-Readiness Checklist

| Item | Status |
|---|---|
| app version / runtimeVersion set | ✓ `1.1.1`, OTA `runtimeVersion: "1.1.1"` (`app.config.js:11,20`) |
| iOS/Android bundle ids | ✓ `com.davros.alba` (`app.config.js:24,43`) |
| iOS permission strings | ✓ location/camera/photo (`app.config.js:29-31`) |
| OTA updates URL | ✓ `app.config.js:18` |
| Sentry init + wrap | ✓ `_layout.tsx:31-36,153` (disabled in `__DEV__`/no-DSN) |
| EXPO_PUBLIC env via EAS | ✗ no `env` in `eas.json`; relies on dashboard (MOB-06) |
| No shipped secrets | ✗ FB appID/clientToken hardcoded (MOB-07); Stripe fallback key (MOB-04) |
| No hardcoded dev URLs | ✓ none found (API_BASE_URL env-driven) |
| USE_MOCK_DATA off | ✓ `false`; but location mock fallback remains (MOB-15) |
| 401 / token refresh | ✗ absent (MOB-02) |
| ErrorBoundary | ✗ absent (MOB-03) |
| Offline handling | ✗ REST flows unprotected (MOB-09) |
| Pagination | ✗ none (MOB-10) |
| Deep links / associatedDomains | ✓ `app.golfalba.co` (`app.config.js:26,45-58`) |

---

## Task List

1. [Critical] Remove/align EVENING time slot (mobile option or backend enum) — MOB-01
2. [Critical] Add shared axios client w/ 401 → force-refresh+retry → logout — MOB-02, MOB-11
3. [Critical] Add global ErrorBoundary fallback — MOB-03
4. [High] Remove hardcoded Stripe fallback key; gate payments when key missing — MOB-04
5. [High] Resolve CONFIRMED player-status enum (add server-side or drop from mobile) — MOB-05
6. [High] Add `env` to eas.json / document EAS env + startup assertions — MOB-06
7. [High] Move FB/Reddit/Google fallbacks to required env; rotate exposed token — MOB-07
8. [Medium] Fix UserProfileDto to snake_case + type the edit-profile payload — MOB-08
9. [Medium] Add NetInfo offline handling + banner — MOB-09
10. [Medium] Add cursor pagination to feeds/games/golfers/conversations — MOB-10
11. [Low] Finish or hide moderation User Management; fix JoinRequestCard distance; remove location mock — MOB-12, MOB-13, MOB-15
12. [Low] Split >600 LOC files — MOB-14

**Total estimate: ~13.5 man-days**

---

## Open Questions

1. Is `EVENING` an intended time slot for game creation? Prisma + v1 allow it, main `/games` DTO does not — which is canonical for the mobile create flow?
2. Is the mobile app meant to call `/games` or `/v1/games`? Backend exposes both with different DTOs (v1 requires `course_id`, `game_format`, min players 2, and accepts EVENING). Mobile currently hits non-v1 `/games`. Confirm the target.
3. Does player `CONFIRMED` status exist server-side (e.g., post-payment transition)? If so the backend `UpdatePlayerStatusDto` and service need it; otherwise remove from mobile.
4. Are required `EXPO_PUBLIC_*` vars configured in EAS for the `production` channel? Cannot verify from repo — needs EAS dashboard check.
5. Is the hardcoded Facebook clientToken the production one (needs rotation) or a throwaway dev token?
