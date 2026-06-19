---
phase: 5
title: "Reliability & Infrastructure"
status: pending
priority: P1
effort: "~15d"
dependencies: []
---

# Phase 5: Reliability & Infrastructure

## Overview
Đưa backend lên mức vận hành prod: CI/CD gate, graceful shutdown, env validation at boot, observability đúng, khả năng scale ngang, và các security-hardening hạ tầng (helmet/throttler/CORS/Swagger gating). Có thể chạy song song từ sớm. Nguồn: `research/04` (deploy target = Railway) + `research/01` (infra-level security). 

## Requirements
- Functional: deploy bị chặn nếu build/lint/test fail; app khởi động fail-fast khi thiếu env; chạy được >1 instance.
- Non-functional: zero-downtime redeploy; log/observability đủ điều tra sự cố; rate limit + security headers.

## Findings xử lý
| ID | Sev | Vấn đề | Evidence |
|----|-----|--------|----------|
| INF-01 | Crit | Không có CI/CD; test/lint không gate deploy | `.github/` absent, `package.json:17` |
| INF-02 | Crit | Không graceful shutdown; Prisma không `$disconnect` on destroy → SIGTERM redeploy abort request + leak conn | `main.ts`, `prisma.service.ts` |
| INF-04 | Crit | Không env validation (`ConfigModule.forRoot` thiếu `validationSchema`) → fail muộn lúc runtime | `app.module.ts:45` |
| INF-05/06 | Crit | Single-instance lock-in: Socket.IO in-memory adapter + room state in-process; CacheModule in-memory ttl:0 → không scale ngang | `chat.gateway.ts`, `app.module.ts:59` |
| SEC (infra) | Med | CORS mở hết; Swagger không gate prod; thiếu throttler; thiếu helmet | `main.ts:42,38-41`; absent |
| INF-07.. | Med/Low | Dockerfile chưa multi-stage/non-root/healthcheck; port hardcode 3000; entrypoint `dist/main.js` vs `dist/src/main.js` lệch | `Dockerfile`, `start.sh`, `main.ts` |

> Positive: kiến trúc cron (one-shot runner, 1 Railway service/job, fail loudly, flush Sentry) thiết kế tốt — giữ nguyên.

## Architecture
- **CI/CD**: GitHub Actions (hoặc tương đương) chạy install → lint → typecheck → test → build; chặn merge/deploy khi đỏ. Tách workflow BE & RN.
- **Lifecycle**: `app.enableShutdownHooks()`; Prisma `OnModuleDestroy` → `$disconnect`; drain WS/HTTP khi SIGTERM.
- **Config**: `validationSchema` (Joi/zod) cho mọi env bắt buộc; fail-fast at boot; tách dev/staging/prod.
- **Scale**: Redis adapter cho Socket.IO + Redis cache (thay in-memory) nếu chạy >1 instance (phụ thuộc Open Q3 số instance).
- **Security hardening**: helmet; `@nestjs/throttler` global; CORS whitelist domain; gate Swagger sau `NODE_ENV`/auth.
- **Container/health**: Dockerfile multi-stage + non-root + healthcheck; health endpoint (`/health` liveness/readiness); port từ env; sửa entrypoint lệch.
- **Observability**: structured logger (đồng bộ Phase 4), đảm bảo Sentry sampling/env-gating đúng, không log dữ liệu nhạy cảm.

## Related Code Files
- Create: `.github/workflows/backend-ci.yml`, `.github/workflows/mobile-ci.yml`
- Modify: `src/main.ts`, `src/app.module.ts`, `src/prisma/prisma.service.ts`
- Create: `src/health/*` (health check), env validation schema
- Modify: `Dockerfile`, `start.sh`, `docker-run.sh`
- Modify: Socket.IO gateway + cache config (Redis adapter) nếu multi-instance

## Implementation Steps
1. CI pipeline BE+RN: lint+typecheck+test+build, chặn deploy khi fail. (INF-01; nền cho Phase 7 gate)
2. `enableShutdownHooks` + Prisma `$disconnect` + drain on SIGTERM. (INF-02)
3. Env `validationSchema` fail-fast; tài liệu hoá biến bắt buộc. (INF-04)
4. Quyết định số instance (Open Q3); nếu >1: Redis adapter cho Socket.IO + Redis cache. (INF-05/06)
5. Thêm helmet + throttler + CORS whitelist + gate Swagger. (SEC infra)
6. Dockerfile multi-stage/non-root/healthcheck; health endpoint; port từ env; sửa entrypoint. (INF-07)
7. Rà Sentry config + structured logging; smoke test deploy staging.

## Success Criteria
- [ ] PR đỏ (lint/test/build) không deploy được.
- [ ] Redeploy không abort request đang chạy; không leak DB connection.
- [ ] Thiếu env bắt buộc → app fail ngay lúc boot với message rõ.
- [ ] (Nếu multi-instance) chat + cache hoạt động đúng qua >1 instance.
- [ ] helmet + rate limit active; Swagger không lộ ở prod; CORS giới hạn domain.
- [ ] Health endpoint xanh; container chạy non-root.

## Risk Assessment
- Redis adapter thêm dependency hạ tầng → chỉ làm nếu thực sự multi-instance (xác nhận Q3).
- Env validation có thể chặn boot ở môi trường đang thiếu biến → rollout cùng tài liệu env.
- CORS whitelist sai gây chặn client hợp lệ → phối hợp domain với mobile/web.
