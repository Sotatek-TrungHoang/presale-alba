# Alba Golf – Product Overview & PDR

## Product Vision

Alba is a cross-platform social mobile application designed to connect golfers, facilitate game organization, and enable real-time interaction. Built with React Native and Expo, it targets iOS and Android with a unified codebase.

**Core Value Proposition:** Simplify golf game discovery, booking, and social connectivity for enthusiast golfers.

---

## Product Features

### 1. Authentication & Onboarding
- **Multi-method login**: Email/password, Google OAuth, Apple Sign-In, Facebook OAuth
- **Guided onboarding**: 7-step onboarding flow (step1–step7)
- **Account recovery**: Forgot password / reset password flows
- **Profile management**: Upload profile photo, set preferences during onboarding

### 2. Golf Game Discovery & Management
- **Game listing**: Browse nearby games with course information
- **Game creation**: Organizers create games with date, time, course, cost
- **Join requests**: Players request to join; organizers approve/reject
- **Game states**: CREATED → READY → IN_PROGRESS → COMPLETED/CANCELLED
- **Real-time game chat**: WebSocket-based chat per game
- **Game details**: Players see organizer info, course details, other participants

### 3. Course Information
- **Course directory**: Browse available golf courses
- **Course details**: Hole information, ratings, difficulty
- **Location-based discovery**: Courses near user location via Mapbox
- **Tee time information**: Integration with external tee time systems

### 4. Payment Integration
- **Stripe onboarding**: Organizers connect Stripe accounts
- **Game payments**: Players pay green fees via Stripe
- **Payment state tracking**: PENDING → PAID → REFUNDED workflows
- **Payout setup**: Organizers set up banking for payouts

### 5. Social & Communication
- **User profiles**: Profile viewing, follow/unfollow
- **Private chat**: Direct messaging between users (socket.io)
- **Game chat**: In-game messaging for coordination
- **User moderation**: Block/report functionality
- **Notifications**: Push notifications for game updates, messages, invites

### 6. Complaints & Disputes
- **Complaint submission**: Players file complaints about games/organizers
- **Complaint tracking**: Status workflow (PENDING → IN_REVIEW → RESOLVED/REFUNDED/REJECTED)
- **Eligibility checks**: Complaint validity based on game state and user role

---

## Product Development Requirements (PDR)

### Functional Requirements

#### FR1: Authentication & Session Management
- Support email/password, Google, Apple, and Facebook OAuth providers
- Persist auth state using AsyncStorage with Firebase
- Generate and attach Firebase ID tokens to API requests
- Handle token refresh automatically
- Support logout with session cleanup
- **Acceptance Criteria:**
  - User can sign up/login via any provider
  - Auth token persists across app restarts
  - Unauthenticated requests fail with 401

#### FR2: Game Lifecycle Management
- Support game states: CREATED, READY, IN_PROGRESS, COMPLETED, CANCELLED
- Allow organizers to create/edit/delete games
- Allow players to request join with acceptance/rejection by organizer
- Transition games automatically when conditions are met
- Track player status: PENDING, APPROVED, REJECTED, CHECKED_IN
- **Acceptance Criteria:**
  - Game transitions match state machine rules
  - Player statuses update correctly
  - Only authorized users can modify games

#### FR3: Real-Time Communication
- Socket.io server connection for live game & direct messaging
- Automatic reconnection on network loss
- Message history retrieval from API
- Typing indicators (optional)
- **Acceptance Criteria:**
  - Messages sent instantly via socket or fall back to polling
  - Reconnection succeeds within 5s of network recovery

#### FR4: Payment Processing
- Stripe API integration for payment setup and transactions
- Organizer onboarding to Stripe (bank verification)
- Player payment collection (green fees)
- Refund support via API
- **Acceptance Criteria:**
  - Payments complete within 30s
  - Refunds process within 24h backend SLA
  - All PCI compliance via Stripe (no card storage in app)

#### FR5: Location & Course Discovery
- Mapbox map rendering with course markers
- User location request and background tracking (with permission)
- Course list filtering by proximity, difficulty, price
- Integration with course metadata API
- **Acceptance Criteria:**
  - Map renders within 2s
  - Location updates within 10s of movement

#### FR6: Push Notifications
- Expo push notification registration at app launch
- Server-triggered notifications for: game invites, messages, system alerts
- Local notification fallback for development
- Notification deep-linking to relevant screens
- **Acceptance Criteria:**
  - Notifications received within 5s of server send
  - Notification tap navigates to correct screen

#### FR7: Moderation & Safety
- Block/unblock user functionality
- Report user or game for violations
- Complaint submission with reason & evidence
- Admin review workflow (backend owned)
- **Acceptance Criteria:**
  - Blocked users cannot message
  - Reports submitted with required fields
  - Complaint status tracked

### Non-Functional Requirements

#### NFR1: Performance
- App startup time: < 3s on average device
- Screen transition: < 500ms
- List scroll: 60 FPS on most devices (use React Native optimization patterns)
- API response time: < 5s (timeout at 10s)
- **Measurement:** Use Sentry RN for monitoring

#### NFR2: Reliability
- 99.5% API uptime (backend responsibility)
- Graceful degradation: feature fallback if backend unavailable
- Offline support: cache game list, game details, user profile
- Error recovery: automatic retry with exponential backoff
- **Coverage:** All error states tested

#### NFR3: Security
- No hardcoded secrets; all keys via EXPO_PUBLIC_* environment variables
- Firebase auth for user identity (not custom tokens)
- HTTPS-only API communication
- No PII in logs; mask sensitive data in Sentry reports
- Input validation before API submit
- **Compliance:** GDPR-aware (user data deletion, consent)

#### NFR4: Accessibility (a11y)
- WCAG 2.1 AA target
- Screen reader support on all interactive elements
- Keyboard navigation support
- Color contrast ≥ 4.5:1 for text
- **Testing:** Manual testing on iOS VoiceOver, Android TalkBack

#### NFR5: Code Quality
- Test coverage: ≥ 70% (enforced by Jest config)
- TypeScript strict mode enabled
- No console errors in production builds
- Linting: ESLint via `expo lint`
- **Enforcement:** CI/CD checks on PR

#### NFR6: Localization
- Support English (primary)
- Dates/times formatted per device locale
- Currency display per region (USD primary)
- RTL support (future phase)

---

## Architecture Overview

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Mobile** | Expo SDK 54, React Native 0.81 | Cross-platform runtime |
| **Routing** | expo-router v6 | File-based navigation |
| **UI** | React Native components + custom | Views and interactions |
| **State** | Zustand + React Context | Global + local state |
| **API** | Axios | HTTP client |
| **Real-time** | socket.io-client | WebSocket messaging |
| **Auth** | Firebase (email/OAuth) | User identity |
| **Payments** | Stripe SDK (@stripe/stripe-react-native) | Payment processing |
| **Maps** | Mapbox (@rnmapbox/maps) | Location & visualization |
| **Notifications** | Expo push + Sentry | Push alerts & monitoring |
| **Testing** | Jest + @testing-library/react-native | Test automation |
| **Build** | EAS Build + EAS Update | CI/CD & OTA updates |

### Data Flow

```
User Action → Component
  → Hook (business logic)
    → Zustand Store / API Client
      → Axios + Firebase Auth
        → Backend REST API / WebSocket Server
          → Database
```

### State Management

- **Global (cross-screen):** Zustand stores (onboardingStore, profileStore, createGameStore, stripeOnboardingStore)
- **Local (single screen):** useState + useReducer
- **Side-effects:** Custom hooks (useAuth, useGameDetail, useNotifications, etc.)
- **Auth context:** React Context via providers/Auth.tsx

### API Architecture

- **Base URL:** `EXPO_PUBLIC_API_URL` environment variable
- **Authentication:** Bearer token from Firebase ID token in Authorization header
- **Request format:** JSON + snake_case field naming (backend DTO convention)
- **Response codes:** 200 (success), 400 (validation), 401 (auth), 403 (forbidden), 500 (server error)
- **Timeout:** 10s default

### File Organization

```
alba-golf-rn-main/
├── app/                    # expo-router file structure
│   ├── (app)/             # Authenticated routes (tabs, modals)
│   ├── onboarding/        # Onboarding flow
│   ├── +not-found.tsx
│   └── _layout.tsx
├── components/            # Reusable UI components
│   ├── ui/               # Design system (buttons, inputs, modals)
│   ├── game/             # Game-specific (OrganizerView, PlayerView, etc.)
│   ├── home/             # Home screen components
│   ├── user/             # User-related (profiles, avatars)
│   ├── modals/           # Modal dialogs
│   └── moderation/       # Moderation UIs
├── hooks/                # Business logic & data fetching
│   ├── useAuth.ts
│   ├── useGameDetail.ts
│   ├── useNotifications.ts
│   ├── useChatSocket.ts
│   └── ...
├── api/                  # Remote API wrappers (one file per domain)
│   ├── config.ts         # Base URL, headers, helpers
│   ├── games.ts          # /games endpoints
│   ├── courses.ts        # /courses endpoints
│   ├── user.ts           # /user endpoints
│   ├── stripe.ts         # /stripe endpoints
│   └── ...
├── stores/               # Zustand stores (global state)
│   ├── onboardingStore.ts
│   ├── profileStore.ts
│   ├── createGameStore.ts
│   └── stripeOnboardingStore.ts
├── providers/            # React Context providers
│   ├── Auth.tsx          # Auth logic & current user state
│   ├── CoursesProvider.tsx
│   ├── LocationProvider.tsx
│   └── NotificationProvider.tsx
├── utils/                # Pure helper functions
│   ├── formatters.ts     # Date, currency, text formatting
│   ├── validators.ts     # Input validation
│   └── ...
├── constants/            # Static data
│   ├── colors.ts
│   ├── sizes.ts
│   └── ...
├── types/                # TypeScript type definitions
├── assets/               # Images, fonts, icons
├── __tests__/            # Test suites
├── jest.setup.js         # Jest configuration
├── eas.json              # EAS build profiles
└── app.config.js         # Expo app config
```

---

## Development Phases

### Phase 1: Authentication & Onboarding (Complete)
- Email/OAuth login
- Onboarding wizard (7 steps)
- Profile creation
- Firebase integration

### Phase 2: Game Management (Complete)
- Create/browse/join games
- Game state transitions
- Game details screen
- Organizer & player views

### Phase 3: Payment Integration (Complete)
- Stripe onboarding
- Payment collection
- Refund handling

### Phase 4: Real-Time Communication (Complete)
- Socket.io integration
- Game chat
- Direct messaging
- Typing indicators

### Phase 5: Notifications & Location (Complete)
- Push notification setup
- Notification handling
- Mapbox integration
- Course discovery

### Phase 6: Moderation & Safety (Complete)
- Block/report functionality
- Complaint workflow
- Admin dashboard (backend)

### Phase 7: Testing & Quality (In Progress)
- Unit test coverage ≥ 70%
- Integration tests
- E2E testing strategy

---

## Success Metrics

| Metric | Target | Owner |
|--------|--------|-------|
| App stability (crash-free users) | > 99% | Mobile Team |
| Test coverage | ≥ 70% | QA / Team |
| Time to create game | < 60s | UX / Mobile |
| Payment success rate | > 99% | Backend / Stripe |
| Notification delivery | > 98% | Backend / Mobile |
| User retention (DAU) | TBD | Product |
| API latency (p95) | < 5s | Backend / DevOps |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Firebase auth provider outage | Users can't login | Implement OAuth fallback, document recovery |
| Socket.io connection loss | Chat unavailability | Automatic reconnect + message queue |
| Mapbox rate limiting | Map unavailable | Cache map tiles locally, use offline mode |
| Stripe API errors | Payment failures | Retry logic with backoff, clear error messaging |
| High test flakiness | Slow CI/CD | Mock time-dependent tests, use stable selectors |
| iOS/Android feature divergence | Maintenance burden | Test on both platforms in CI, shared test suite |

---

## Future Roadmap

### Short-term (Next 3 months)
- Increase test coverage to 75%+
- Implement offline mode for game list
- Add in-game scoring/leaderboard
- Improve push notification targeting

### Medium-term (3–6 months)
- Implement tournament/league features
- Add handicap integration
- Introduce friend groups & team management
- Launch referral program

### Long-term (6+ months)
- Web dashboard for organizers
- Advanced analytics & replay
- Sponsor/brand integration
- International expansion

---

## Version History

| Version | Date | Status | Key Changes |
|---------|------|--------|-------------|
| 1.1.1 | Jun 2024 | Current | Refactoring, improved game detail components |
| 1.1.0 | May 2024 | Released | Payment integration, Stripe onboarding |
| 1.0.0 | Apr 2024 | Released | MVP: auth, games, chat, notifications |

