# System Architecture

This document describes the Alba mobile app's architecture, data flow, and key system components.

---

## Architecture Overview

Alba follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────┐
│     User Interface (Screens)        │  expo-router file structure
├─────────────────────────────────────┤
│  Components + Styling               │  React Native UI components
├─────────────────────────────────────┤
│  Business Logic (Hooks)             │  Custom hooks, state management
├─────────────────────────────────────┤
│  State Management (Zustand/Context) │  Global state, providers
├─────────────────────────────────────┤
│  API Client (Axios)                 │  HTTP requests, config
├─────────────────────────────────────┤
│  External Services                  │  Firebase, Stripe, Mapbox, etc.
└─────────────────────────────────────┘
```

---

## Data Flow

### User Action → Render Cycle

```
User Interaction
    ↓
Component Handler / Button Press
    ↓
Custom Hook (Business Logic)
    ↓
API Call / State Update
    ↓
Store Update (Zustand/Context)
    ↓
Component Re-render with New State
```

### Example: Join Game Flow

```typescript
// 1. User taps "Join Game" button
<Pressable onPress={() => handleJoinGame(gameId)} />

// 2. Component calls hook
const { joinGame, loading } = useGameActions(gameId);

// 3. Hook calls API function
export async function requestJoinGame(gameId: string) {
  const token = await auth.currentUser?.getIdToken();
  return axios.post(buildApiUrl(`games/${gameId}/join`), {}, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

// 4. Hook updates local state
const [loading, setLoading] = useState(false);
const joinGame = async () => {
  setLoading(true);
  try {
    await requestJoinGame(gameId);
    // Update store or refetch
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

// 5. Component re-renders with new state
return <Text>{loading ? 'Joining...' : 'Join'}</Text>;
```

---

## Routing & Navigation

### File-Based Routing (expo-router)

The app structure follows expo-router conventions with the `app/` directory:

```
app/
├── _layout.tsx                    # Root layout (nav container)
├── +not-found.tsx                 # 404 fallback
├── welcome.tsx                    # Unauth: welcome screen
├── login.tsx                      # Unauth: login
├── reset-password.tsx             # Unauth: reset
├── forgot-password.tsx            # Unauth: forgot
├── onboarding/
│   ├── _layout.tsx
│   ├── index.tsx                  # Step 0 / entry
│   ├── step1.tsx                  # Profile photo
│   ├── step2.tsx                  # Name & details
│   ├── step3.tsx                  # Courses
│   ├── step4.tsx                  # Handicap
│   ├── step5.tsx                  # Game size preference
│   ├── step6.tsx                  # Green fees
│   └── step7.tsx                  # Review & confirm
└── (app)/                         # Authenticated routes (drawer/tabs)
    ├── _layout.tsx                # Main app layout (tabs/drawer)
    ├── (tabs)/                    # Tab navigator
    │   ├── _layout.tsx
    │   ├── home.tsx               # Home/dashboard
    │   ├── discover.tsx           # Game discovery
    │   ├── my-games.tsx           # User's games
    │   ├── chat.tsx               # Messages/conversations
    │   └── profile.tsx            # User profile
    ├── game/
    │   └── [id].tsx               # Game details (dynamic)
    ├── course/
    │   └── [id].tsx               # Course details (dynamic)
    ├── chat/
    │   └── [conversationId].tsx   # Chat conversation
    ├── edit-profile/
    │   └── index.tsx              # Profile editing
    ├── create-round/
    │   └── index.tsx              # Game creation
    └── [other routes]             # Additional screens
```

### Navigation Context

Root layout applies the Auth provider to determine route visibility:

```typescript
// app/_layout.tsx
function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

// AuthProvider decides unauthenticated vs authenticated routes
function RootNavigator() {
  const { user } = useAuth();
  return user ? <AuthenticatedStack /> : <UnauthenticatedStack />;
}
```

---

## Authentication Flow

### Firebase as Identity Provider

```
User → Email/OAuth Provider
    ↓
Firebase Auth (creates user, issues ID token)
    ↓
Token stored in AsyncStorage (via getReactNativePersistence)
    ↓
Token injected into API requests as Authorization header
    ↓
Backend validates token and processes request
```

### Auth Provider (React Context)

Location: `providers/Auth.tsx`

Responsibilities:
- Manage Firebase auth state (login, logout, signup)
- Store current user in context
- Attach ID token to API requests
- Handle session persistence across app restarts

```typescript
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, setUser);
    setLoading(false);
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook for components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}
```

### Login Methods

1. **Email/Password:** Firebase native
2. **Google Sign-In:** `@react-native-google-signin/google-signin` + Firebase
3. **Apple Sign-In:** `expo-apple-authentication` + Firebase
4. **Facebook:** `react-native-fbsdk-next` + Firebase

All methods return a Firebase ID token which is stored and reused.

---

## State Management Architecture

### Global State: Zustand Stores

Each store is a separate file in `stores/`, holding domain-specific state.

```typescript
// stores/gameStore.ts
interface GameStoreState {
  selectedGameId: string | null;
  filterCourse: string | null;
  setSelectedGameId: (id: string | null) => void;
  setFilterCourse: (course: string | null) => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  selectedGameId: null,
  filterCourse: null,
  setSelectedGameId: (id) => set({ selectedGameId: id }),
  setFilterCourse: (course) => set({ filterCourse: course }),
}));
```

**Existing Stores:**
- `onboardingStore`: Current step, profile data during onboarding
- `profileStore`: Logged-in user's profile, preferences
- `createGameStore`: Form state for game creation
- `stripeOnboardingStore`: Organizer Stripe setup state

### Local State: React Hooks

Component-level state for UI state (form inputs, modals, loading indicators):

```typescript
const [gameList, setGameList] = useState<Game[]>([]);
const [isFilterOpen, setIsFilterOpen] = useState(false);
const [selectedFilter, setSelectedFilter] = useState<Filter | null>(null);
```

### Provider-Level State: Context

Providers handle cross-cutting concerns that don't fit Zustand:

- **AuthProvider:** Current user session
- **CoursesProvider:** Cached courses list
- **LocationProvider:** User's current location
- **NotificationProvider:** Push notification registration & handlers

---

## API Architecture

### Base Configuration

File: `api/config.ts`

```typescript
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
export const DEFAULT_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000, // 10s
};

export const buildApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  const cleanBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${cleanBaseUrl}/${cleanEndpoint}`;
};
```

### API Modules

Each domain has a dedicated file: `api/{domain}.ts`

**Pattern:**

```typescript
// api/games.ts
import axios from 'axios';
import { buildApiUrl, DEFAULT_CONFIG } from './config';
import { auth } from '@/firebase.config';

// 1. Type definitions
export interface Game {
  id: string;
  title: string;
  course_id: string;
  organizer_id: string;
  scheduled_date: string;
  status: 'CREATED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  // ... more fields
}

// 2. Fetch operations
export async function fetchGames(): Promise<Game[]> {
  const token = await auth.currentUser?.getIdToken();
  const { data } = await axios.get(buildApiUrl('games'), {
    ...DEFAULT_CONFIG,
    headers: { ...DEFAULT_CONFIG.headers, 'Authorization': `Bearer ${token}` },
  });
  return data;
}

export async function fetchGameById(gameId: string): Promise<Game> {
  const token = await auth.currentUser?.getIdToken();
  const { data } = await axios.get(buildApiUrl(`games/${gameId}`), {
    ...DEFAULT_CONFIG,
    headers: { ...DEFAULT_CONFIG.headers, 'Authorization': `Bearer ${token}` },
  });
  return data;
}

export async function createGame(game: Omit<Game, 'id'>): Promise<Game> {
  const token = await auth.currentUser?.getIdToken();
  const { data } = await axios.post(buildApiUrl('games'), game, {
    ...DEFAULT_CONFIG,
    headers: { ...DEFAULT_CONFIG.headers, 'Authorization': `Bearer ${token}` },
  });
  return data;
}
```

**Existing API modules:**
- `games.ts` (game CRUD, join requests, actions)
- `courses.ts` (course listing, details, tee times)
- `user.ts` (profile, follow, block)
- `stripe.ts` (payment setup, transactions, payouts)
- `chat.ts` (message history, conversations)
- `conversations.ts` (conversation listing)
- `notifications.ts` (notification preferences, status)
- `location.ts` (nearby games/courses)
- `complaints.ts` (filing complaints)
- `follow.ts` (follow/unfollow users)
- `attribution.ts` (attribution data)
- `blocks.ts` (blocked users)
- `reports.ts` (report content)

### Authentication Header Injection

All API calls must include Firebase ID token in `Authorization: Bearer <token>` header.

```typescript
const token = await auth.currentUser?.getIdToken();
// Always pass token in headers for authenticated endpoints
```

### Error Handling

```typescript
try {
  const game = await fetchGameById(gameId);
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      // Token expired or invalid → logout user
      logout();
    } else if (error.response?.status === 403) {
      // Forbidden → show permission error
    } else if (error.response?.status === 404) {
      // Not found
    } else if (error.response?.status >= 500) {
      // Server error → retry with backoff
    }
  }
  // Log to Sentry
  Sentry.captureException(error);
}
```

---

## Real-Time Communication

### Socket.io for Chat

WebSocket connection for live messaging (game chat & direct messages).

**Initialization:**

```typescript
// hooks/useChatSocket.ts
import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

function getSocket(userId: string): Socket {
  if (!socketInstance) {
    socketInstance = io(process.env.EXPO_PUBLIC_API_URL, {
      auth: { userId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
  }
  return socketInstance;
}
```

**Events:**

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join_game` | Client → Server | Subscribe to game chat |
| `leave_game` | Client → Server | Unsubscribe from game chat |
| `send_message` | Client → Server | Send message to chat |
| `message` | Server → Client | Receive message |
| `typing` | Client → Server | Notify user is typing |
| `user_typing` | Server → Client | Notify other user typing |

**Example:**

```typescript
const socket = getSocket(userId);

// Join game chat
socket.emit('join_game', { gameId: 'game-123' });

// Listen for new messages
socket.on('message', (msg: ChatMessage) => {
  setMessages((prev) => [...prev, msg]);
});

// Send message
socket.emit('send_message', { gameId: 'game-123', text: 'Hello!' });

// Cleanup on unmount
socket.off('message');
socket.emit('leave_game', { gameId: 'game-123' });
```

---

## Custom Hooks Architecture

Custom hooks encapsulate business logic and data fetching, making components testable and reusable.

### Data Fetching Hooks

Load data from API on mount, manage loading/error states, provide refetch method.

```typescript
// hooks/useGameDetail.ts
export function useGameDetail(gameId: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchGameById(gameId);
        if (isMounted) setGame(data);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Error');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, [gameId]);

  const refetch = async () => {
    try {
      setLoading(true);
      const data = await fetchGameById(gameId);
      setGame(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return { game, loading, error, refetch };
}
```

### Action Hooks

Perform mutations (POST/PATCH/DELETE), handle loading/error states, trigger refetch on success.

```typescript
// hooks/useGameActions.ts
export function useGameActions(gameId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinGame = async () => {
    try {
      setLoading(true);
      await requestJoinGame(gameId);
      // Trigger parent refetch or update store
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const approvePlayer = async (playerId: string) => {
    try {
      setLoading(true);
      await approvePlayerRequest(gameId, playerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return { joinGame, approvePlayer, loading, error };
}
```

**Existing Hooks:**
- `useAuth`: Current user session
- `useGameDetail`: Fetch game details
- `useGameActions`: Game mutations (join, approve, reject, etc.)
- `useMyGames`: Fetch user's games
- `useGameChatSocket`: WebSocket for game chat
- `useChatSocket`: WebSocket for direct messages
- `useComplaints`: File/fetch complaints
- `useNotifications`: Notification setup & handling
- `useGettingStartedChecklist`: Onboarding progress
- `useCoursesData`: Courses listing & details
- `useUserProfile`: Fetch user profile
- `useStripeRequirements`: Stripe account status
- `useDebounce`: Debounce search input
- `useTheme`: Dark mode provider
- `useColorScheme`: Platform color scheme detection

---

## Component Architecture

### Component Hierarchy

```
RootLayout (_layout.tsx)
├── AuthProvider
├── NotificationProvider
├── LocationProvider
├── CoursesProvider
└── RootNavigator
    ├── UnauthenticatedStack (login, welcome, onboarding)
    └── AuthenticatedStack (tabs, modals, screens)
        ├── TabNavigator
        │   ├── HomeScreen
        │   ├── DiscoverScreen
        │   ├── MyGamesScreen
        │   ├── ChatScreen
        │   └── ProfileScreen
        ├── GameDetailScreen
        ├── CourseDetailScreen
        ├── ChatConversationScreen
        └── [other screens]
```

### Component Organization

```
components/
├── ui/                     # Design system
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   ├── Input.tsx
│   └── ... (base components)
├── game/                   # Game feature
│   ├── GameCard.tsx
│   ├── OrganizerView.tsx
│   ├── PlayerView.tsx
│   ├── GameBottomActions.tsx
│   └── ...
├── home/                   # Home screen
│   ├── GameListItem.tsx
│   ├── FilterBar.tsx
│   └── ...
├── user/                   # User features
│   ├── UserProfile.tsx
│   ├── FollowButton.tsx
│   └── ...
├── modals/                 # Modal dialogs
│   ├── BookingConfirmationModal.tsx
│   ├── CancelGameModal.tsx
│   └── ...
└── moderation/             # Moderation UIs
    ├── BlockUserModal.tsx
    ├── ReportModal.tsx
    └── ...
```

### Sub-Component Pattern

Large screens delegate sections to sub-components:

```typescript
// app/(app)/game/[id].tsx
function GameDetailScreen({ gameId }: { gameId: string }) {
  const { game, loading } = useGameDetail(gameId);
  const { user } = useAuth();

  if (loading) return <LoadingPlaceholder />;

  const isOrganizer = user?.id === game.organizer_id;

  return (
    <ScrollView>
      <GameHeader game={game} />
      {isOrganizer ? (
        <OrganizerView game={game} />
      ) : (
        <PlayerView game={game} />
      )}
      <GameChatSection gameId={gameId} />
      <GameBottomActions game={game} gameId={gameId} />
    </ScrollView>
  );
}
```

---

## Notifications Architecture

### Expo Push Notifications Flow

```
App Launch
  ↓
Request notification permission
  ↓
Register device with Expo notification service
  ↓
Get notification token (store in backend)
  ↓
Backend sends push via Expo API
  ↓
Device receives push
  ↓
App handles notification (deep link to relevant screen)
```

**Setup:**

```typescript
// hooks/useNotifications.ts
import * as Notifications from 'expo-notifications';

export function useNotifications() {
  useEffect(() => {
    async function registerForPushNotificationsAsync() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permission denied');
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      // Send token to backend to associate with user
      await saveNotificationToken(token);
    }

    registerForPushNotificationsAsync();

    // Handle notification tap
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const { screen, gameId } = response.notification.request.content.data;
      if (screen === 'game') {
        // Navigate to game detail
        router.push(`/game/${gameId}`);
      }
    });

    return () => subscription.remove();
  }, []);
}
```

---

## Offline & Caching Strategy

### Cache Layers

1. **App Memory:** Store fetched data in useState/Zustand
2. **AsyncStorage:** Persist critical data (user profile, auth token)
3. **API Timeout Fallback:** Show cached data if API fails

```typescript
// Simple cache pattern
const [games, setGames] = useState<Game[]>(() => {
  const cached = localStorage.getItem('games');
  return cached ? JSON.parse(cached) : [];
});

useEffect(() => {
  fetchGames()
    .then((data) => {
      setGames(data);
      localStorage.setItem('games', JSON.stringify(data));
    })
    .catch(() => {
      // Show cached data on error
    });
}, []);
```

### Offline Handling

- **Readonly screens:** Show cached game list / profiles
- **Forms:** Queue requests in localStorage, sync on reconnect
- **Chat:** Queue messages, deliver on reconnection

---

## Error Handling & Monitoring

### Sentry Integration

All errors logged to Sentry for monitoring and debugging:

```typescript
import * as Sentry from '@sentry/react-native';

try {
  await processPayment(amount);
} catch (err) {
  Sentry.captureException(err, {
    tags: { feature: 'payment' },
    contexts: { amount },
  });
}
```

### Error Recovery

- **API errors:** Show user-friendly message + retry button
- **Network errors:** Implement exponential backoff retry
- **Auth errors (401/403):** Logout + redirect to login
- **Payment errors:** Show specific reason (declined card, insufficient funds, etc.)

---

## Performance Optimization

### Rendering Performance

- Use `useMemo` only for expensive computations
- Use `useCallback` for stable callback references
- Use `FlatList` with `keyExtractor` and renderItem
- Implement list virtualization for long lists

### Network Performance

- Batch requests where possible (GraphQL approach)
- Implement request cancellation on unmount
- Use caching to avoid duplicate requests
- Monitor API latency via Sentry

### Memory Performance

- Clean up subscriptions in useEffect return
- Avoid circular dependencies in state
- Use `isMounted` flag to prevent state updates after unmount

---

## Deployment & Versioning

### EAS Build Profiles

Defined in `eas.json`:

| Profile | Distribution | Use Case |
|---------|-------------|----------|
| `development` | Internal | Local testing |
| `development-tf` | App Store | QA testing |
| `preview` | App Store / Google Play | Staging testing |
| `production` | App Store / Google Play | Production release |

### Version Management

- Semantic versioning: MAJOR.MINOR.PATCH
- Update in `package.json` and `app.config.js`
- Runtime version in `app.config.js` controls EAS Updates

### OTA Updates

```javascript
// app.config.js
export default {
  updates: {
    url: "https://u.expo.dev/98d855d4-43ae-4808-8abc-cef08fcb9e4b",
  },
  runtimeVersion: "1.1.1",
};
```

EAS Update allows pushing new JS code without app store review.

---

## Security Considerations

### Authentication

- Firebase manages user identity (no custom auth)
- ID tokens have 1-hour expiry, auto-refresh handled by Firebase SDK
- Refresh tokens stored securely in AsyncStorage

### API Security

- All requests over HTTPS (enforced by Expo)
- No hardcoded credentials (use EXPO_PUBLIC_* for public vars, environment-based secrets for sensitive)
- Bearer token injection ensures only authenticated requests reach backend

### Payment Security

- Card data never enters app (Stripe handles it)
- Only Stripe tokens/payment intents transmitted
- Backend validates all payment requests

### Data Handling

- User data in logs masked (no PII in logs)
- Sentry configured to scrub sensitive data
- No sensitive data cached in AsyncStorage without encryption

---

## Tech Stack Summary

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Expo SDK | 54 |
| React | React | 19.1 |
| React Native | RN | 0.81 |
| Routing | expo-router | 6 |
| State (Global) | Zustand | 5 |
| State (Local) | React Hooks | 19 |
| HTTP Client | Axios | 1.8 |
| Real-time | socket.io-client | 4.8 |
| Auth | Firebase | 11.5 |
| Payments | Stripe RN | 0.65 |
| Maps | Mapbox RN | 10.3 |
| Testing | Jest + RTL-RN | 29/13.2 |
| Linting | ESLint (Expo) | - |
| Build | EAS | 16.12+ |

