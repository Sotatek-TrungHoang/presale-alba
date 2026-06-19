# Alba Codebase Summary

High-level overview of the Alba golf mobile app codebase structure, key files, and architectural patterns.

---

## Project Metadata

| Property | Value |
|----------|-------|
| **Project Name** | Alba Golf |
| **Type** | React Native Mobile App (iOS/Android) |
| **Runtime** | Expo SDK 54 |
| **Language** | TypeScript |
| **Build Tool** | EAS Build & EAS Update |
| **Version** | 1.1.1 |
| **Entry Point** | `app/_layout.tsx` (expo-router) |

---

## Directory Structure & File Organization

```
alba-golf-rn-main/
├── app/                           # expo-router file-based routing
│   ├── _layout.tsx                # Root layout + auth provider
│   ├── +not-found.tsx             # 404 fallback
│   ├── welcome.tsx                # Welcome screen (unauth)
│   ├── login.tsx                  # Login screen
│   ├── reset-password.tsx         # Password reset flow
│   ├── forgot-password.tsx        # Forgot password flow
│   ├── onboarding/                # 7-step onboarding flow
│   │   ├── _layout.tsx
│   │   ├── index.tsx              # Onboarding entry
│   │   ├── step1.tsx              # Profile photo
│   │   ├── step2.tsx              # Name, age, location
│   │   ├── step3.tsx              # Course preferences
│   │   ├── step4.tsx              # Handicap
│   │   ├── step5.tsx              # Game size pref
│   │   ├── step6.tsx              # Green fees
│   │   └── step7.tsx              # Review & confirm
│   └── (app)/                     # Authenticated routes (protected)
│       ├── _layout.tsx            # Main app layout (tabs/drawer)
│       ├── (tabs)/                # Tab-based navigation
│       │   ├── _layout.tsx        # Tab navigator
│       │   ├── home.tsx           # Home/dashboard screen
│       │   ├── discover.tsx       # Game discovery
│       │   ├── my-games.tsx       # User's games list
│       │   ├── chat.tsx           # Messages/conversations
│       │   └── profile.tsx        # User profile
│       ├── game/                  # Game routes
│       │   └── [id].tsx           # Game detail screen (dynamic)
│       ├── course/                # Course routes
│       │   └── [id].tsx           # Course detail (dynamic)
│       ├── chat/                  # Chat routes
│       │   └── [conversationId].tsx # Conversation (dynamic)
│       ├── edit-profile/
│       │   └── index.tsx          # Profile editing
│       ├── create-round/
│       │   └── index.tsx          # Create new game
│       └── [other screens]
│
├── components/                    # Reusable React Native components
│   ├── ui/                        # Design system components
│   │   ├── Button.tsx             # Primary button
│   │   ├── Card.tsx               # Card container
│   │   ├── Modal.tsx              # Modal dialog
│   │   ├── Input.tsx              # Text input
│   │   ├── ComplaintBanner.tsx    # Complaint status display
│   │   └── [other UI components]
│   ├── game/                      # Game feature components
│   │   ├── GameCard.tsx           # Game list item
│   │   ├── OrganizerView.tsx      # Game detail for organizers
│   │   ├── PlayerView.tsx         # Game detail for players
│   │   ├── GameBottomActions.tsx  # Action buttons
│   │   └── [other game components]
│   ├── home/                      # Home screen sub-components
│   │   ├── GameListItem.tsx
│   │   ├── FilterBar.tsx
│   │   └── [other home components]
│   ├── user/                      # User-related components
│   │   ├── UserProfile.tsx
│   │   ├── FollowButton.tsx
│   │   ├── UserAvatar.tsx
│   │   └── [other user components]
│   ├── modals/                    # Modal dialogs
│   │   ├── BookingConfirmationModal.tsx
│   │   ├── CancelGameModal.tsx
│   │   ├── PaymentModal.tsx
│   │   └── [other modals]
│   ├── moderation/                # Safety & moderation
│   │   ├── BlockUserModal.tsx
│   │   ├── ReportModal.tsx
│   │   ├── ComplaintModal.tsx
│   │   └── [other moderation components]
│   └── __tests__/                 # Component tests
│       ├── GameCard.test.tsx
│       ├── ComplaintBanner.test.tsx
│       └── [other component tests]
│
├── hooks/                         # Custom React hooks (business logic)
│   ├── useAuth.ts                 # Auth state accessor
│   ├── useGameDetail.ts           # Fetch game details
│   ├── useGameActions.ts          # Game mutations (join, approve, etc.)
│   ├── useMyGames.ts              # Fetch user's games
│   ├── useGameChatSocket.ts       # WebSocket for game chat
│   ├── useChatSocket.ts           # WebSocket for direct messages
│   ├── useComplaints.ts           # File/fetch complaints
│   ├── useNotifications.ts        # Push notification setup
│   ├── useGettingStartedChecklist.ts # Onboarding progress
│   ├── useCoursesData.ts          # Fetch courses
│   ├── useUserProfile.ts          # Fetch user profile
│   ├── useStripeRequirements.ts   # Stripe account status
│   ├── useDebounce.ts             # Debounce hook
│   ├── useTheme.ts                # Theme provider
│   ├── useColorScheme.ts          # Color scheme detection
│   ├── useStyles.ts               # Dynamic styles
│   ├── useThemeColor.ts           # Theme color accessor
│   └── __tests__/                 # Hook tests
│       ├── useGameDetail.test.ts
│       ├── useComplaints.test.ts
│       └── [other hook tests]
│
├── api/                           # REST API wrappers (one per domain)
│   ├── config.ts                  # Base URL, headers, helpers
│   ├── games.ts                   # /games endpoints
│   ├── courses.ts                 # /courses endpoints
│   ├── user.ts                    # /user endpoints
│   ├── stripe.ts                  # /stripe payment endpoints
│   ├── chat.ts                    # /chat message endpoints
│   ├── conversations.ts           # /conversations endpoints
│   ├── notifications.ts           # /notifications endpoints
│   ├── location.ts                # /location nearby endpoints
│   ├── complaints.ts              # /complaints endpoints
│   ├── follow.ts                  # /follow endpoints
│   ├── blocks.ts                  # /blocks endpoints
│   ├── attribution.ts             # /attribution endpoints
│   ├── reports.ts                 # /reports endpoints
│   └── __tests__/                 # API tests
│       ├── games.test.ts
│       └── [other API tests]
│
├── stores/                        # Zustand global state stores
│   ├── onboardingStore.ts         # Onboarding progress & data
│   ├── profileStore.ts            # Logged-in user profile
│   ├── createGameStore.ts         # Game creation form state
│   └── stripeOnboardingStore.ts   # Organizer Stripe setup state
│
├── providers/                     # React Context providers
│   ├── Auth.tsx                   # Auth state & login logic
│   ├── CoursesProvider.tsx        # Courses caching
│   ├── LocationProvider.tsx       # User location tracking
│   └── NotificationProvider.tsx   # Push notification setup
│
├── utils/                         # Pure utility functions
│   ├── formatters.ts              # Date, currency, text formatting
│   ├── validators.ts              # Input validation
│   ├── [other utils]
│   └── __tests__/                 # Utility tests
│
├── constants/                     # Static data & configuration
│   ├── colors.ts                  # Design color tokens
│   ├── sizes.ts                   # Spacing, sizing tokens
│   ├── [other constants]
│
├── types/                         # TypeScript type definitions
│   ├── game.ts                    # Game domain types
│   ├── user.ts                    # User domain types
│   ├── [other type files]
│
├── assets/                        # Images, fonts, icons
│   ├── images/                    # PNG/SVG images
│   │   ├── alba-icon.png
│   │   ├── alba-transparent.png
│   │   └── [other images]
│   ├── fonts/                     # Custom fonts
│   └── [other assets]
│
├── __tests__/                     # Root test directory
│   ├── utils/                     # Utility test helpers
│   └── [test infrastructure]
│
├── .cursor/                       # Cursor IDE settings
│   └── rules/
│       └── expo-rules.mdc         # Expo style guidelines
│
├── Configuration Files            # Project config
│   ├── package.json               # Dependencies, scripts, Jest config
│   ├── tsconfig.json              # TypeScript config (strict mode)
│   ├── app.config.js              # Expo app configuration
│   ├── eas.json                   # EAS Build profiles
│   ├── firebase.config.js         # Firebase initialization
│   ├── jest.setup.js              # Jest test setup
│   ├── babel.config.js            # Babel config for Expo
│   ├── metro.config.js            # Metro bundler config
│   └── .gitignore                 # Git ignore patterns
│
├── Documentation Files
│   ├── README.md                  # Main project README
│   ├── TESTING.md                 # Testing strategy
│   ├── NOTIFICATION_SETUP.md      # Push notification setup
│   ├── NOTIFICATION_INTEGRATION.md # Backend notification flows
│   ├── MAPBOX_SETUP.md            # Mapbox configuration
│   ├── REFACTORING_SUMMARY.md     # Game detail refactoring history
│   └── docs/                      # Full documentation (this folder)
│
└── Other Files
    ├── google-services.json       # Firebase Android config
    ├── coverage/                  # Jest coverage reports
    ├── .easignore                 # EAS Build ignore patterns
    ├── expo_output.log            # Expo CLI logs
    └── Frame *.png                # Mockup screenshots
```

---

## Key Files & Purpose

### Configuration & Setup

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, npm scripts, Jest config |
| `tsconfig.json` | TypeScript strict mode, path aliases |
| `app.config.js` | Expo app name, version, plugins, permissions |
| `eas.json` | EAS Build profiles (development, preview, production) |
| `firebase.config.js` | Firebase initialization with AsyncStorage persistence |
| `jest.setup.js` | Jest test setup, mocks, global config |
| `babel.config.js` | Babel preset for Expo |
| `metro.config.js` | Metro bundler config |
| `.cursor/rules/expo-rules.mdc` | Cursor IDE style guidelines for Expo |

### Entry Points

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Root layout, Auth provider, navigation setup |
| `package.json` "main" | `expo-router/entry` (Expo router entry) |

### API Layer

| File | Purpose |
|------|---------|
| `api/config.ts` | Base URL, default headers, buildApiUrl helper |
| `api/games.ts` | Game CRUD, join requests, state transitions |
| `api/courses.ts` | Course listing, details, tee times |
| `api/user.ts` | User profile, follow, block |
| `api/stripe.ts` | Payment setup, transactions, refunds |
| `api/chat.ts` | Message history, conversation metadata |
| `api/notifications.ts` | Notification preferences, token management |

### State Management

| File | Purpose |
|------|---------|
| `stores/onboardingStore.ts` | Onboarding step, profile data during signup |
| `stores/profileStore.ts` | Current user profile & preferences |
| `stores/createGameStore.ts` | Game creation form state |
| `stores/stripeOnboardingStore.ts` | Stripe onboarding progress |
| `providers/Auth.tsx` | Firebase auth, current user context |
| `providers/LocationProvider.tsx` | User location (lat/long), permission |
| `providers/CoursesProvider.tsx` | Cached courses list |
| `providers/NotificationProvider.tsx` | Push notification token & handlers |

### Screens (Routes)

| File | Purpose |
|------|---------|
| `app/welcome.tsx` | Welcome landing (unauth) |
| `app/login.tsx` | Login with email/OAuth |
| `app/forgot-password.tsx` | Password recovery |
| `app/onboarding/` | 7-step onboarding wizard |
| `app/(app)/(tabs)/home.tsx` | Home/dashboard (auth) |
| `app/(app)/(tabs)/discover.tsx` | Game discovery with map/list |
| `app/(app)/(tabs)/my-games.tsx` | User's created/joined games |
| `app/(app)/(tabs)/chat.tsx` | Conversations list |
| `app/(app)/(tabs)/profile.tsx` | User profile |
| `app/(app)/game/[id].tsx` | Game detail (organizer/player views) |
| `app/(app)/course/[id].tsx` | Course detail |
| `app/(app)/chat/[conversationId].tsx` | Chat conversation |

### Components (Reusable)

| File | Purpose |
|------|---------|
| `components/ui/Button.tsx` | Primary button component |
| `components/ui/Card.tsx` | Card container |
| `components/ui/Modal.tsx` | Modal dialog |
| `components/game/OrganizerView.tsx` | Game detail UI for organizers |
| `components/game/PlayerView.tsx` | Game detail UI for players |
| `components/game/GameBottomActions.tsx` | Join/payment/chat actions |
| `components/modals/BookingConfirmationModal.tsx` | Booking confirmation dialog |

### Hooks (Business Logic)

| File | Purpose |
|------|---------|
| `hooks/useAuth.ts` | Access auth context |
| `hooks/useGameDetail.ts` | Fetch & manage game details |
| `hooks/useGameActions.ts` | Game mutations (join, approve, etc.) |
| `hooks/useNotifications.ts` | Push notification registration & handling |
| `hooks/useChatSocket.ts` | WebSocket for direct messages |
| `hooks/useGameChatSocket.ts` | WebSocket for game chat |
| `hooks/useComplaints.ts` | File & fetch complaints |

### Tests

| File | Purpose |
|------|---------|
| `__tests__/hooks/useComplaints.test.ts` | Unit tests for complaints hook |
| `__tests__/components/ui/ComplaintBanner.test.tsx` | UI component tests |
| `__tests__/api/games.test.ts` | API wrapper tests |

---

## Technology Stack

### Core Runtime
- **Expo SDK 54** — Cross-platform React Native runtime
- **React 19.1** — UI framework
- **React Native 0.81** — Native component bindings
- **expo-router 6** — File-based routing (like Next.js)

### State Management
- **Zustand 5** — Lightweight global state
- **React Context** — Provider-level state
- **React Hooks** — useState, useEffect, useReducer

### HTTP & Real-Time
- **Axios 1.8** — HTTP client
- **socket.io-client 4.8** — WebSocket messaging

### Authentication & Services
- **Firebase 11.5** — Auth (email/OAuth), user identity
- **@stripe/stripe-react-native 0.65** — Payment processing
- **@rnmapbox/maps 10.3** — Maps & location
- **expo-notifications** — Push notifications
- **@sentry/react-native 7.2** — Error monitoring

### UI & Styling
- **react-native-reanimated 4.1** — Performant animations
- **react-native-gesture-handler 2.28** — Gesture recognition
- **@expo/vector-icons 15** — Icon library
- **react-native-safe-area-context 5.6** — Safe area handling
- **expo-blur** — Blur effects

### Testing
- **Jest 29** — Test runner
- **@testing-library/react-native 13.2** — Component testing
- **jest-expo 54** — Expo-specific Jest preset
- **MSW 2.10** — Mock API responses

### Developer Tools
- **TypeScript 5.9** — Static type checking
- **Prettier** — Code formatting
- **ESLint (via expo lint)** — Code linting
- **EAS Build** — CI/CD for native builds
- **EAS Update** — OTA JavaScript updates

---

## Architecture Patterns

### Component Structure
1. **Type definitions** → Interfaces for props
2. **Sub-components** → If component has sections
3. **Helper functions** → Internal utilities
4. **Main component** → Exported JSX
5. **Export default** → Component export

### Hook Pattern (Data Fetching)
1. **State setup** → useState for data/loading/error
2. **Effect hook** → useEffect for API calls
3. **Cleanup** → Return cleanup function
4. **Return object** → { data, loading, error, refetch }

### API Pattern
1. **Type definitions** → Response interfaces
2. **HTTP functions** → Exported async functions
3. **Auth injection** → Bearer token in headers
4. **Error handling** → Try-catch with Sentry logging

### State Pattern (Zustand)
1. **Interface definition** → State type
2. **Store creation** → create() with actions
3. **Hook export** → useXyzStore hook
4. **Component usage** → Destructure from hook

### Provider Pattern (Context)
1. **Context creation** → createContext()
2. **Provider component** → ReactNode children
3. **Hook creation** → useXyz() with error check
4. **Root setup** → Wrap app in provider

---

## Testing Coverage

### Coverage Threshold (Enforced)
- **Global minimum:** 70%
- **By category:** Components 70%, Hooks 80%, Utils 85%

### Test Organization
- Tests co-locate with source: `__tests__/` at same level
- Pattern: `*.test.ts` or `*.test.tsx`
- Setup in `jest.setup.js` (mocks, globals)

### Test Types
- **Unit tests** → Hooks, utilities, API functions
- **Component tests** → UI components, rendering, interaction
- **Integration tests** → Multi-component workflows

---

## Code Standards Summary

- **Language:** TypeScript strict mode
- **Components:** Functional only (no classes)
- **Naming:** camelCase variables, PascalCase components, kebab-case dirs
- **Types:** Interfaces preferred over types
- **Enums:** Avoid; use object maps instead
- **Imports:** Use `@/` path alias
- **Max lines:** Components < 150, Hooks < 100, Screens < 250
- **Comments:** Why, not what; business logic only
- **Testing:** ≥ 70% coverage enforced

---

## Development Workflow

### Local Setup
```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with Firebase, Stripe, Mapbox keys

# Run dev server
npm start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

### Testing
```bash
# Run test suite
npm test

# Generate coverage report
npm run test:coverage

# Watch mode
npm run test:watch

# Test specific category
npm run test:hooks
npm run test:components
```

### Linting
```bash
# Run ESLint (Expo)
npm run lint
```

### Building
```bash
# Development build (internal distribution)
eas build --profile development

# Preview build (to App Store)
eas build --profile preview --platform ios,android

# Production build
eas build --profile production --platform ios,android

# Submit to stores
eas submit --profile production
```

---

## Known Issues & Workarounds

### Associating Domains
App uses `associatedDomains` for deep linking. iOS requires proper XCode signing setup. See README for details.

### Socket.io Reconnection
WebSocket may disconnect on network loss. Automatic reconnect with exponential backoff configured (1-5 sec delay).

### Large Component Refactoring
Game detail screen (`app/(app)/game/[id].tsx`) was refactored from 1,255 lines to 277 lines. See `REFACTORING_SUMMARY.md` for approach.

---

## Related Documentation

- **[README.md](../README.md)** — Project setup & scripts
- **[TESTING.md](../TESTING.md)** — Test strategy & examples
- **[NOTIFICATION_SETUP.md](../NOTIFICATION_SETUP.md)** — Push notification setup
- **[NOTIFICATION_INTEGRATION.md](../NOTIFICATION_INTEGRATION.md)** — Backend notification flows
- **[MAPBOX_SETUP.md](../MAPBOX_SETUP.md)** — Mapbox configuration
- **[REFACTORING_SUMMARY.md](../REFACTORING_SUMMARY.md)** — Game detail refactoring
- **[project-overview-pdr.md](./project-overview-pdr.md)** — Product requirements
- **[code-standards.md](./code-standards.md)** — Coding conventions
- **[system-architecture.md](./system-architecture.md)** — Technical architecture

---

## Quick Facts

- **LOC Estimate:** ~50–60K (code + tests, excluding node_modules)
- **Packages:** ~150+ npm dependencies
- **Test Files:** ~15 test suites, targeting ≥70% coverage
- **Screens:** ~20+ routes (auth, onboarding, tabs, modals)
- **API Domains:** 13 (games, courses, user, stripe, chat, etc.)
- **Stores:** 4 Zustand stores
- **Providers:** 4 Context providers
- **Custom Hooks:** ~20 hooks
- **Components:** ~50+ reusable components
- **Supported Platforms:** iOS 13+, Android 7+

