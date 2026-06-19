# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This directory holds **two independent, sibling projects** for the Alba golf social platform. There is no root `package.json`; run all commands from inside the relevant subproject.

- `alba-golf-rn-main/` — Expo / React Native mobile app (iOS + Android), TypeScript.
- `alba-social-backend-main/` — NestJS 10 + Prisma + PostgreSQL REST/WebSocket API.

The mobile app talks to the backend over REST (`EXPO_PUBLIC_API_URL`) and Socket.IO. Both authenticate the **same user** via Firebase: the app obtains a Firebase ID token, the backend verifies it with `firebase-admin`.

## Commands

### Mobile (`alba-golf-rn-main/`)
- `npm start` — Expo dev server. `npm run ios` / `npm run android` / `npm run web` for a platform.
- `npm test` — Jest (jest-expo preset). `npm run test:ci` for CI (coverage, no watch).
- Run a subset: `npm run test:hooks`, `npm run test:components`, `npm run test:utils`.
- Single test: `npx jest path/to/file-test.tsx -t "test name"`.
- `npm run lint` — `expo lint`. Coverage threshold is **70%** (branches/functions/lines/statements); CI fails below it.
- Native builds via EAS — profiles in `eas.json` (see `README.md` → Building & releasing).

### Backend (`alba-social-backend-main/`)
- `npm run start:dev` — Nest in watch mode (`http://localhost:3000`, Swagger at `/api`).
- `npm run build` then `npm run start:prod` — prod (runs `prisma generate` → build → start).
- `npm test` / `npm run test:watch` / `npm run test:cov` — Jest unit. `npm run test:e2e` — e2e (`test/jest-e2e.json`).
- Single test: `npx jest src/games/games.service.spec.ts -t "name"`.
- `npm run lint` — ESLint with `--fix`.
- Prisma: `npx prisma generate`, `npx prisma migrate dev --name <name>` (dev), `npx prisma migrate deploy` (prod), `npx prisma studio`.
- Data scripts: `npm run import-courses`, `npm run cron:notifications`.

## Architecture

### Mobile (`alba-golf-rn-main/`)
- **Routing**: file-based via `expo-router` in `app/`. Auth/unauthed screens at the top (`login`, `welcome`, `onboarding/step1..7`); the authenticated app lives under `app/(app)/` with a tab navigator in `app/(app)/(tabs)/`.
- **API layer** (`api/`): one file per domain (`games.ts`, `chat.ts`, `stripe.ts`, …). All use `axios` + the helpers in `api/config.ts` (`buildApiUrl`, `DEFAULT_CONFIG`). Every authenticated request attaches `Authorization: Bearer <firebase id token>` obtained via `getIdToken(auth.currentUser)`. Add new endpoints here, never inline `fetch` in components.
- **State**: Zustand stores in `stores/` (e.g. `onboardingStore`, `profileStore`, `createGameStore`). Cross-cutting runtime concerns are React Context `providers/` (`Auth`, `CoursesProvider`, `LocationProvider`, `NotificationProvider`). Business logic lives in `hooks/` (`useAuth`, `useGameActions`, `useChatSocket`, …) — screens stay thin.
- **Auth** (`providers/Auth.tsx`): Firebase email/password + Google + Apple sign-in; on signup it calls the backend onboarding endpoint via `api/user.ts`.
- **Config**: `app.config.js` (Expo config, bundle IDs, native permissions, EAS update). `firebase.config.js` exports the `auth` instance. Path alias `@/*` → project root (tsconfig + jest `moduleNameMapper`).
- Integrations: Stripe (`@stripe/stripe-react-native`), Mapbox (`@rnmapbox/maps`, see `MAPBOX_SETUP.md`), Sentry, Expo push notifications (`NOTIFICATION_SETUP.md`, `NOTIFICATION_INTEGRATION.md`).

### Backend (`alba-social-backend-main/`)
- **Modular NestJS**: one module per domain under `src/` (`games`, `courses`, `stripe`, `conversations`/`messages`, `posts`, `groups`, `notifications`, `leaderboards`, `relationships`, `complaints`, `reports`, `blocks`, `profiles`, `users`, …). Each follows controller → service (business logic) → Prisma. Wired in `src/app.module.ts`.
- **Bootstrap** (`src/main.ts`): `rawBody: true` (required for Stripe webhook signature verification), global `ValidationPipe` (transform + implicit conversion), Swagger at `/api`, CORS enabled, static assets from `public/`. Sentry is initialized before the app (`shared/sentry.config.ts`).
- **Auth**: `guards/firebase-auth.guard.ts` verifies the Firebase ID token from the `Authorization` header; `guards/admin.guard.ts` gates admin routes. Firebase admin setup in `src/firebase/`.
- **Database**: Prisma, single schema `prisma/schema.prisma` (~1k lines) with migrations in `prisma/migrations/`. Access via injected `PrismaService` (`src/prisma/`). Convention: **snake_case** field names (e.g. `course_id`, `players_needed`, `time_slot`) and soft deletes via `deleted_at`. DTO enums (game_type, game_format, time_slot, etc.) must stay in sync with the mobile `api/*.ts` types.
- **Real-time**: Socket.IO gateways in `src/websockets/` back chat and live notifications.
- **Payments**: `src/stripe/` uses Stripe Connect for organizer payouts. Funds are held ~2 days post-game for disputes. Webhook flow documented in `STRIPE_WEBHOOKS.md`.
- **Cron**: scheduled jobs in `src/cron/` (notifications runner); see `CRON.md`.
- **Versioning**: `src/v1/` holds a v1-scoped module (e.g. `v1/games`) for evolving endpoints alongside the legacy ones.

### Core domain flow
Onboarding (golf preferences) → post a game/round with requirements → system recommends games → players request to join → organizer approves → books off-app → requests payment split → players pay via Stripe → funds held → payout. Read backend `README.md` "Core Workflow" before touching game/payment logic.

## Conventions
- **Field naming across the wire is snake_case** (DB, DTOs, and the mobile API types) — match it exactly; the rest of the TS code is camelCase.
- Mobile: functional components, named exports, interfaces over types, avoid enums (use maps/string unions), keep logic in hooks. See `alba-golf-rn-main/.cursor/rules/expo-rules.mdc`.
- Backend: declare types (avoid `any`), small single-purpose services, `class-validator` DTOs, throw NestJS HTTP exceptions, use Prisma transactions for multi-step writes.
- Each project has its own `node_modules`; never assume a shared root install.

## Project-specific docs
- Mobile: `alba-golf-rn-main/` → `TESTING.md`, `MAPBOX_SETUP.md`, `NOTIFICATION_SETUP.md`, `NOTIFICATION_INTEGRATION.md`, `REFACTORING_SUMMARY.md`.
- Backend: `alba-social-backend-main/` → `STRIPE_WEBHOOKS.md`, `CRON.md`.
