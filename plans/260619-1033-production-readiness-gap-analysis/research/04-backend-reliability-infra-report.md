# Backend Reliability / Infra / Observability — Production-Readiness Audit

**Target:** `/Users/trung.hoang/Desktop/presale-sotatek/alba/alba-social-backend-main`
**Stack:** NestJS 10, Prisma 5, Socket.IO, Postgres. **Deploy target:** Railway (confirmed via `CRON.md:1`).
**Date:** 2026-06-19. Auditor dimension: DevOps/SRE — reliability, infra, observability.

---

## Summary Table

| ID | Severity | Title |
|----|----------|-------|
| INF-01 | Critical | No CI/CD pipeline — zero automated build/test/lint gate before deploy |
| INF-02 | Critical | No graceful shutdown — `enableShutdownHooks` absent, Prisma never disconnects, WS clients dropped hard |
| INF-03 | Critical | `dump-prod-to-dev.sh` DROPs ALL tables in `$DATABASE_URL` target — prod-wipe footgun |
| INF-04 | Critical | No required-env validation — app boots with missing config, fails silently/late |
| INF-05 | High | Socket.IO uses default in-memory adapter — cannot scale beyond 1 instance |
| INF-06 | High | CacheModule is in-memory (`ttl:0`, max 100) — not shared, never evicts; breaks multi-instance + memory leak risk |
| INF-07 | High | No health/liveness/readiness endpoint for the API server (only a Stripe-scoped `/health`) |
| INF-08 | High | Dockerfile/start.sh inconsistency + image not hardened (root user, no healthcheck, `npm install` not `ci`) |
| INF-09 | High | 202 `console.*` calls — unstructured logging, no JSON logs, no log levels, no correlation IDs |
| INF-10 | Medium | Prisma client has no connection-pool / timeout tuning; default pool can exhaust under load |
| INF-11 | Medium | Hardcoded port `3000` in `main.ts` ignores `PORT` env (Railway injects PORT) |
| INF-12 | Medium | Sentry `beforeSend` filters any error whose message contains the char `'4'` — drops real errors |
| INF-13 | Medium | CORS fully open (`enableCors()` + WS `origin:'*'`) — infra/abuse exposure, no origin allowlist |
| INF-14 | Medium | No rate limiting / throttler / helmet — no infra-level abuse protection |
| INF-15 | Low | Swagger UI (`/api`) exposed unconditionally, even in production |
| INF-16 | Low | `start.sh` echoes env for "debugging" and is unused/divergent from Docker CMD |

---

## Findings

### INF-01 — No CI/CD pipeline [Critical]
**Evidence:** No `.github/` dir, no `.gitlab-ci.yml`, no `*.yml` CI files anywhere (grepped: `find . -name "*.yml"` → none CI-related; `ls .github` → absent). Deploy is Railway auto-build from repo (`CRON.md:49`).
**Impact:** Nothing runs `npm test`, `npm run lint`, or `npm run build` before code ships. Tests exist (`jest`, `package.json:17`) but are never gated. Broken builds, failing tests, and lint errors reach production undetected. No reproducible build artifact, no rollback discipline.
**Fix:** Add GitHub Actions (or Railway pre-deploy) workflow: install → lint → test → build → (on green) deploy. Block merge on red.
**Estimate:** 1.5 man-days.

### INF-02 — No graceful shutdown [Critical]
**Evidence:** `main.ts` — no `app.enableShutdownHooks()`, no SIGTERM/SIGINT handler (grep `enableShutdownHooks|SIGTERM|SIGINT|onApplicationShutdown` → 0 hits). `PrismaService` (`src/prisma/prisma.service.ts`) implements only `onModuleInit`/`$connect` — no `OnModuleDestroy`/`$disconnect`.
**Impact:** On Railway redeploy/scale, the container gets SIGTERM and is killed mid-request. In-flight HTTP requests aborted, DB connections leaked (not closed), WebSocket clients hard-dropped, Sentry events not flushed. Causes connection-pool exhaustion on Postgres over repeated deploys and lost data on writes.
**Fix:** Call `app.enableShutdownHooks()` in `main.ts`; add `OnModuleDestroy` → `$disconnect()` in PrismaService; close Socket.IO server gracefully; flush Sentry on shutdown.
**Estimate:** 1 man-day.

### INF-03 — Prod-database wipe footgun in dump script [Critical]
**Evidence:** `dump-prod-to-dev.sh:59` sets `DEV_DATABASE_URL="${DATABASE_URL}"`; lines 171/175 build and run `DROP TABLE IF EXISTS ... CASCADE` for **every** table in `public` against that URL via `psql`. Target is derived purely from `$DATABASE_URL` with no environment guard.
**Impact:** If `DATABASE_URL` happens to point at production (a common local/CI misconfig), running the script silently DROPS the entire production schema. No confirmation prompt, no host-name safety check, no "are you sure this is dev?" guard. Single-keystroke total data loss.
**Fix:** Add an explicit safety guard: refuse to run unless target host matches a dev allowlist or `--i-understand-this-drops-everything` flag is passed; print target host and require interactive confirmation; never accept prod hostnames as the drop target.
**Estimate:** 0.5 man-day.

### INF-04 — No required-env validation at boot [Critical]
**Evidence:** `app.module.ts:45` `ConfigModule.forRoot({ isGlobal: true })` — no `validationSchema`, no `validate` (grep `validationSchema` → 0). Only 8 `process.env` reads total but critical ones (`DATABASE_URL`, `STRIPE_*`, `FIREBASE_*`, AWS S3, Google Maps, Expo) are read ad-hoc with no startup assertion. `sentry.config.ts:8` merely `console.warn`s and continues if DSN missing.
**Impact:** App boots "successfully" with missing/blank credentials, then fails at first request (Stripe charge, S3 upload, push notification) with opaque runtime errors instead of failing fast at boot. Hard to diagnose, partial-availability outages.
**Fix:** Add Joi/zod `validationSchema` to `ConfigModule.forRoot` listing all required env vars; app crashes loudly at boot with a clear message if any are missing.
**Estimate:** 0.5 man-day.

### INF-05 — Socket.IO not multi-instance capable [High]
**Evidence:** `src/websockets/chat.gateway.ts:20` `@WebSocketGateway` with default adapter; no Redis adapter, no `IoAdapter` override (grep `redis|IoAdapter|adapter` → only Sentry HttpAdapterHost, none for Socket.IO). Room state held in process memory: `chat.gateway.ts` `private rooms = new Map<...>()`.
**Impact:** Cannot horizontally scale the API. With >1 instance behind Railway, WebSocket messages and room membership are siloed per instance — users on different instances don't receive each other's messages. Forces single-instance deploy → single point of failure, no rolling deploys without dropping all sockets.
**Fix:** Add `@socket.io/redis-adapter` (or Railway-managed Redis) and a custom `IoAdapter`; move `rooms` state out of process memory; require sticky sessions only as fallback.
**Estimate:** 2 man-days.

### INF-06 — In-memory cache, no eviction, not shared [High]
**Evidence:** `app.module.ts:59-63` `CacheModule.register({ isGlobal:true, ttl:0, max:100 })`. `ttl:0` = cache indefinitely (no expiry); used by `courses.service.ts:64`.
**Impact:** (a) Cache is per-instance — inconsistent reads across instances. (b) `ttl:0` means entries never expire → stale data served indefinitely (e.g. course data) until restart. (c) Unbounded staleness; `max:100` caps count but the no-TTL policy means correctness bugs. Blocks scaling and causes stale-data incidents.
**Fix:** Use a Redis cache store; set a sane TTL; document invalidation strategy.
**Estimate:** 1 man-day.

### INF-07 — No API health/liveness/readiness endpoint [High]
**Evidence:** Only health endpoint is `src/stripe/stripe-webhook.controller.ts:23` `@Get('health')` scoped under the Stripe webhook route — not a root liveness/readiness probe and not DB-aware. No `@nestjs/terminus` (grep `terminus|liveness|readiness` → none).
**Impact:** Railway / load balancer cannot distinguish "process up" from "app ready & DB reachable". Bad instances stay in rotation; no readiness gate during boot/migration. Harder to detect partial outages.
**Fix:** Add `@nestjs/terminus` health module with `/health` (liveness) and `/ready` (readiness incl. Prisma DB ping); wire to Railway healthcheck path.
**Estimate:** 0.5 man-day.

### INF-08 — Container hardening + Dockerfile/start.sh divergence [High]
**Evidence:** `Dockerfile`: runs as **root** (no `USER` directive), no `HEALTHCHECK`, builder stage uses `npm install` not `npm ci` (`Dockerfile:14` — non-reproducible), `prisma generate` run twice (builder + prod). `Dockerfile:63` CMD = `npx prisma migrate deploy && node dist/main.js`. `start.sh:11` runs `node dist/src/main.js` — **different path** and echoes env vars (`start.sh:6-8`). One of these paths is wrong for the build output; `start.sh` appears unused/stale.
**Impact:** Running as root = larger blast radius if compromised. No `HEALTHCHECK` = orchestrator can't self-detect dead container. `npm install` = non-deterministic prod builds. Path divergence = latent breakage if someone switches the entrypoint to `start.sh`. Coupling `prisma migrate deploy` into CMD means every instance start (incl. each scaled replica) races to run migrations.
**Fix:** Add non-root `USER node`; add `HEALTHCHECK` hitting `/health`; switch builder to `npm ci`; delete or reconcile `start.sh`; run `migrate deploy` as a one-shot release step, not per-instance CMD, to avoid concurrent-migration races.
**Estimate:** 1 man-day.

### INF-09 — Unstructured logging via console.* [High]
**Evidence:** 202 `console.*` calls across `src` (`grep -rn "console\." src` → 202), e.g. `chat.gateway.ts` `console.log(\`Client connected: ${client.id}\`)`. Nest `Logger` used only sporadically (notifications, cron, sentry filter). Default Nest logger = plain text, not JSON.
**Impact:** No structured (JSON) logs for ingestion/search, no consistent log levels, no request/correlation IDs, no way to silence noisy debug logs in prod. PII/IDs printed freely. Observability and incident triage severely hampered on Railway log stream.
**Fix:** Standardize on a structured logger (pino / `nestjs-pino`); replace `console.*`; add request-id middleware; set log level by env.
**Estimate:** 1.5 man-days.

### INF-10 — Prisma pool/timeout untuned [Medium]
**Evidence:** `prisma.service.ts` instantiates bare `PrismaClient` with no `datasources`/`connection_limit`/timeout config; `DATABASE_URL` carries no pool params (default Prisma pool = num_cpus*2+1 per instance).
**Impact:** Under concurrency, connections can exhaust Postgres `max_connections` (esp. combined with INF-02 leaks on redeploy). No statement/transaction timeouts → a slow query can pin a connection indefinitely.
**Fix:** Set `connection_limit` and `pool_timeout` via DATABASE_URL params; add query/transaction timeouts; consider PgBouncer for serverless-style scaling.
**Estimate:** 0.5 man-day.

### INF-11 — Hardcoded listen port [Medium]
**Evidence:** `main.ts:43` `await app.listen(3000)` — ignores `process.env.PORT` (Dockerfile sets `ENV PORT=3000` but app doesn't read it; Railway injects its own `PORT`).
**Impact:** On Railway (which assigns `PORT` dynamically), a hardcoded 3000 can cause the platform to mark the service unhealthy / fail to route. Brittle across environments.
**Fix:** `app.listen(process.env.PORT ?? 3000)`.
**Estimate:** 0.1 man-day.

### INF-12 — Sentry beforeSend over-filters [Medium]
**Evidence:** `sentry.config.ts:22-31` — `if (error.message.includes('4')) return null;` intended to drop 4xx but matches the literal character `'4'` anywhere in any error message.
**Impact:** Any real error whose message contains a "4" (e.g. "failed after 4 retries", "S3 404… no — any '4'") is silently dropped from Sentry → blind spots in error monitoring.
**Fix:** Filter on HTTP status code / exception type, not substring match on the message.
**Estimate:** 0.2 man-day.

### INF-13 — Wide-open CORS [Medium]
**Evidence:** `main.ts:42` `app.enableCors()` (default = reflect all origins); `chat.gateway.ts:23` WS `cors: { origin: '*' }`.
**Impact:** Any origin can call the API / connect WS — broadens CSRF/abuse surface from an infra standpoint; no allowlist for prod.
**Fix:** Restrict `origin` to known app/web origins per environment via config.
**Estimate:** 0.3 man-day.

### INF-14 — No rate limiting / helmet [Medium]
**Evidence:** grep `throttl|rate.?limit|helmet` → 0 hits. No `@nestjs/throttler`, no `helmet`.
**Impact:** No infra-level protection against brute-force / scraping / DoS on auth, search, upload endpoints; no security headers.
**Fix:** Add `@nestjs/throttler` global guard + `helmet` middleware.
**Estimate:** 0.5 man-day.

### INF-15 — Swagger exposed in prod [Low]
**Evidence:** `main.ts:35-41` `SwaggerModule.setup('api', ...)` unconditional — no `NODE_ENV` gate.
**Impact:** Full API surface map published at `/api` in production.
**Fix:** Gate Swagger setup behind `NODE_ENV !== 'production'` (or auth).
**Estimate:** 0.2 man-day.

### INF-16 — start.sh prints env / divergent entrypoint [Low]
**Evidence:** `start.sh:6-8` echoes NODE_ENV/PORT and DATABASE_URL-is-set; path differs from Docker CMD (see INF-08).
**Impact:** Minor info leak into logs; dead/confusing script.
**Fix:** Remove the file or align it with the canonical entrypoint.
**Estimate:** 0.1 man-day.

---

## Production-Readiness Checklist

| Area | Status | Note |
|------|--------|------|
| **CI/CD** | GAP | No pipeline at all (INF-01). Tests/lint exist but never gated. |
| **Containerization** | GAP | Multi-stage ✓, but root user, no healthcheck, `npm install`, double prisma-generate, entrypoint divergence (INF-08). |
| **Config management** | GAP | `@nestjs/config` global ✓ but no validation; missing env fails late (INF-04). No dev/stg/prod separation in code. |
| **Observability — Sentry** | PARTIAL | Sentry wired with env-gated sampling ✓ (`sentry.config.ts:19-21`), but beforeSend bug drops real errors (INF-12). |
| **Observability — logging** | GAP | 202 console.* calls, no structured/JSON logs, no correlation IDs (INF-09). |
| **Health / lifecycle** | GAP | No liveness/readiness probe (INF-07); no graceful shutdown (INF-02); hardcoded port (INF-11). |
| **Resilience — DB** | GAP | No pool/timeout tuning, no graceful disconnect (INF-02, INF-10). |
| **Resilience — cache** | GAP | In-memory, ttl:0, per-instance (INF-06). |
| **Resilience — WS scaling** | GAP | No Redis adapter, in-memory rooms — single-instance only (INF-05). |
| **Resilience — rate limit/headers** | GAP | None (INF-14); CORS open (INF-13). |
| **Background jobs (cron)** | PASS (mostly) | Well-designed one-shot runner, one service per job, fails loudly, flushes Sentry (`scheduled-notifications.runner.ts`, CRON.md). Single-instance-per-cron design avoids duplicate-run risk. Minor: relies on per-job dedup logic in service for at-least-once safety. |
| **Data ops safety** | GAP | dump script can wipe prod (INF-03). |

---

## Task List (by priority)

1. INF-03 prod-wipe guard on dump script — 0.5d **(do first, cheap, catastrophic)**
2. INF-01 CI/CD pipeline (lint+test+build gate) — 1.5d
3. INF-02 graceful shutdown + Prisma disconnect — 1d
4. INF-04 env validation schema — 0.5d
5. INF-07 health/readiness module (terminus) — 0.5d
6. INF-08 container hardening + entrypoint reconcile + migration race fix — 1d
7. INF-05 Socket.IO Redis adapter + externalize room state — 2d
8. INF-06 Redis cache store + TTL — 1d
9. INF-09 structured logging migration — 1.5d
10. INF-11 PORT env — 0.1d
11. INF-12 Sentry filter fix — 0.2d
12. INF-14 throttler + helmet — 0.5d
13. INF-13 CORS allowlist — 0.3d
14. INF-10 Prisma pool/timeout — 0.5d
15. INF-15 gate Swagger — 0.2d
16. INF-16 remove/align start.sh — 0.1d

**Total estimate: ~12.9 man-days** (4 Critical = 3.5d; 5 High = 6d; 5 Medium = 1.7d; 2 Low = 0.3d). Add ~20% integration/test buffer → **~15.5 man-days**.

---

## Open Questions

1. Is the app currently deployed as a **single instance** on Railway? If yes, INF-05/INF-06 are latent (not yet biting) but block any scale-up — confirm scaling intent. [UNVERIFIED — no Railway config in repo]
2. Which entrypoint is actually used in prod — Dockerfile CMD (`dist/main.js`) or `start.sh` (`dist/src/main.js`)? Nest default with `sourceRoot:src` typically emits `dist/main.js`, so `start.sh` path looks stale — needs confirmation against an actual build artifact. [UNVERIFIED — dist not built in repo]
3. Does `migrate deploy` in the Docker CMD run on every replica start? If multiple replicas, confirm migration-lock behavior (Prisma advisory lock mitigates but per-instance startup races remain). [UNVERIFIED]
4. Is there an external WAF/API-gateway in front of Railway providing rate limiting / TLS / origin filtering? If so, INF-13/INF-14 severity drops. [UNVERIFIED]
