# Security Scan Report

**Projects:** `alba-social-backend-main` (NestJS API) + `alba-golf-rn-main` (Expo/React Native)
**Scanned:** 2026-06-19
**Files checked:** ~376 source files (211 backend, 165 RN) + configs, scripts, dependencies
**Scope:** Secret detection, dependency audit, OWASP code-pattern analysis, auth/access-control review
**Note:** Not a git repo at root — git-tracking exposure assessed via `.gitignore` rules.

---

## Summary

| Category     | Critical | High | Medium | Low |
|--------------|----------|------|--------|-----|
| Secrets      | 0        | 0    | 1      | 1   |
| Dependencies | 4        | ~19  | 85     | 12  |
| Code         | 0        | 1    | 4      | 4   |

No hardcoded server-side secrets, private keys, or DB credentials found in source. All secrets load from `process.env`. Raw SQL is parameterized. Firebase auth and Stripe webhook signature verification are correctly implemented. Primary risks: one reflected XSS and a large vulnerable-dependency backlog.

---

## Findings

### HIGH

#### 1. [CODE] Reflected XSS in marketing redirect
**File:** `alba-social-backend-main/src/attribution/go.controller.ts:48-94`

`GET /go` is unauthenticated and reflects attacker-controlled input into HTML **without escaping**:
- `webUrl = https://app.golfalba.co${req.originalUrl}` → injected into `<meta property="og:url" content="${webUrl}">` (line 54) and `app-argument=${webUrl}` (line 49)
- `deepLink` → injected into `<a href="${deepLink}">` (line 80)

`req.originalUrl` carries the raw query string. A request such as `/go?x="><script>...</script>` breaks out of the attribute and executes arbitrary JS in the `app.golfalba.co` origin. Public, no auth required.

**Fix:** HTML-entity-encode `webUrl`/`deepLink` before interpolation (escape `& < > " '`); validate/whitelist expected query keys; add a `Content-Security-Policy` header on this response.

#### 2. [DEPS] Vulnerable dependencies — both projects
- Backend `npm audit`: **63 vulns (3 critical, 14 high, 35 moderate, 11 low)**
- RN `npm audit`: **57 vulns (1 critical, 5 high, 50 moderate, 1 low)**

Runtime-relevant prod packages:
- `jws` — improper HMAC signature verification (auth-adjacent)
- `express` — XSS via `response.redirect()`
- `body-parser` / `multer` / `ws` — DoS / uninitialized memory disclosure
- `fast-xml-parser`, `protobufjs`, `form-data` — critical (entity bypass / code exec / unsafe boundary)
- `lodash`, `serialize-javascript` — code injection / RCE (usage-dependent)

**Fix:** `npm audit fix`, then manually bump pinned majors (`@nestjs/*`, `express`, `multer`, `axios`). Re-audit with `--omit=dev` to prioritize production impact. Many RN findings are build-time (metro/expo) tooling.

---

### MEDIUM

#### 3. [CODE] Unauthenticated PII exposure
**File:** `alba-social-backend-main/src/leaderboards/leaderboards.controller.ts:25`
`GET /leaderboards` has no `@UseGuards` and returns players' **full names**, scores, courses, and dates to anyone. Broken access control / data exposure.
**Fix:** Add `@UseGuards(FirebaseAuthGuard)`, or return non-PII identifiers only.

#### 4. [CODE] CORS fully open
**File:** `alba-social-backend-main/src/main.ts:42`
`app.enableCors()` with no config allows all origins. Risky if cookie/credential flows are added.
**Fix:** Restrict `origin` to known app/web domains.

#### 5. [CODE] No rate limiting
No `ThrottlerModule` / `@Throttle` anywhere in the backend. Auth and webhook endpoints are open to brute-force/abuse.
**Fix:** Add `@nestjs/throttler` globally.

#### 6. [CODE] Swagger exposed unconditionally
**File:** `alba-social-backend-main/src/main.ts:38-41`
`/api` docs served in all environments (no `NODE_ENV` gate). Information disclosure of full API surface.
**Fix:** Gate behind `NODE_ENV !== 'production'` or require auth.

#### 7. [SECRET] Google API key committed
**File:** `alba-golf-rn-main/google-services.json:18` (`AIza…TZV4`, redacted)
Embedded-in-app by design (ships in APK), so low exploit value — **only** safe if API/package-restricted in Google Cloud console.
**Fix:** Confirm key is restricted to the app's package + SHA-1 and to required APIs only.

---

### LOW

#### 8. [CODE] `ValidationPipe` missing `whitelist` / `forbidNonWhitelisted`
**File:** `alba-social-backend-main/src/main.ts:31`
No current mass-assignment risk (services map fields explicitly; no DTO spreads into Prisma writes), but add for defense-in-depth.

#### 9. [CODE] Dead scaffold endpoints
**File:** `alba-social-backend-main/src/leaderboards/leaderboards.controller.ts:20,30,38`
POST/PATCH/DELETE are unauthenticated but no-op stubs (`return 'This action…'`). Remove to avoid future footguns.

#### 10. [CODE] No `helmet`
Missing security headers (HSTS, X-Content-Type-Options, etc.).
**Fix:** Add `helmet` middleware in `main.ts`.

#### 11. [SECRET] Hardcoded Facebook client token fallback
**File:** `alba-golf-rn-main/app.config.js:2`
Client tokens are semi-public for mobile, low risk; prefer env-only configuration.

#### 12. [CODE] Verbose error/stack logging in webhooks
**File:** `alba-social-backend-main/src/stripe/stripe-webhook.controller.ts:100-108,185-195`
Logs stack traces + event data; ensure logs aren't externally exposed.

---

## What's Clean (verified)

- ✅ No `.env`, `.pem`, `.key`, or service-account JSON committed; `.gitignore` excludes them in both projects.
- ✅ No hardcoded AWS/Stripe/GitHub/Anthropic keys, JWT literals, or DB connection strings in source.
- ✅ Prisma `$queryRaw` uses tagged templates — user input (`courseId`, `days`, coordinates) parameterized; `Prisma.raw` wraps only hardcoded column names. No `$queryRawUnsafe`, `eval`, or `child_process`.
- ✅ Firebase ID-token auth guard (`firebase-auth.guard.ts`) and admin guard correctly implemented.
- ✅ Stripe webhook signature verification (`constructWebhookEvent`) enforced on both platform and connect endpoints.
- ✅ Shell scripts (`dump-prod-to-dev.sh`) use env vars for `PGPASSWORD`; no embedded credentials.
- ✅ Firebase Admin creds and all app secrets loaded from `process.env`.

---

## Recommendations (priority order)

1. **Fix the `/go` reflected XSS (#1)** — escape reflected output. Highest exploit/impact.
2. **Run `npm audit fix` on both projects** and bump critical prod deps (#2).
3. **Guard `GET /leaderboards` (#3)**; lock down CORS (#4) and Swagger (#6).
4. **Add throttling + helmet (#5, #10)**; remove dead leaderboard CRUD (#9).
5. **Confirm Google API key restrictions (#7)** in Google Cloud console.

---

## Unresolved Questions

- Are `/round/:id` and `/locations` intentionally public? (`/go`, `/.well-known/*`, and the Stripe webhook clearly are; the other two were not deep-read for data exposure.)
- Is the Google API key (#7) restricted in the Google Cloud console? Cannot verify from code.
