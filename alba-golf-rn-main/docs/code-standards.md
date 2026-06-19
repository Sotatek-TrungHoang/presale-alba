# Code Standards & Project Structure

This document defines the coding conventions, architecture patterns, and best practices for the Alba mobile app.

---

## TypeScript & Language Standards

### Strict Mode & Types

- **TypeScript Strict Mode:** Enabled in `tsconfig.json`
- **Type Safety:** Always use explicit types, avoid `any`
- **Interfaces over Types:** Use `interface` for object contracts, `type` only for unions/literals
- **Enums:** Avoid enums; use discriminated unions or object maps instead

```typescript
// ✅ Good: Map-based approach
const GameStatus = {
  CREATED: 'CREATED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

type GameStatusType = typeof GameStatus[keyof typeof GameStatus];

// ❌ Avoid: Enums
enum GameStatus {
  CREATED = 'CREATED',
  READY = 'READY',
}
```

### Function Declarations

- Use `function` keyword for named functions
- Use arrow functions for callbacks and handlers
- Always specify parameter and return types

```typescript
// ✅ Good
function calculateGameCost(basePrice: number, playerCount: number): number {
  return basePrice * playerCount;
}

const handleJoinClick = (gameId: string): void => {
  // handler logic
};

// ❌ Avoid: Implicit types
function calculateGameCost(basePrice, playerCount) {
  return basePrice * playerCount;
}
```

---

## React & Component Patterns

### Functional Components Only

- Use only functional components with hooks
- No class components
- Use `React.FC<Props>` for typed components (or just type the props argument)

```typescript
// ✅ Good
interface GameCardProps {
  gameId: string;
  title: string;
  onJoin: (gameId: string) => void;
}

function GameCard({ gameId, title, onJoin }: GameCardProps): JSX.Element {
  return (
    <Pressable onPress={() => onJoin(gameId)}>
      <Text>{title}</Text>
    </Pressable>
  );
}

export default GameCard;
```

### Component Structure

Order components as follows:

1. **Imports**
2. **Type definitions & interfaces** (at file top)
3. **Sub-components** (if any)
4. **Helper functions** (internal utilities)
5. **Main component function**
6. **Export**

```typescript
import { View, Text, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useGameDetail } from '@/hooks/useGameDetail';

// Types
interface HeaderProps {
  title: string;
}

// Sub-component
function Header({ title }: HeaderProps) {
  return <Text style={{ fontSize: 18 }}>{title}</Text>;
}

// Helper function
function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

// Main component
function GameDetailScreen({ gameId }: { gameId: string }) {
  const { game, loading } = useGameDetail(gameId);

  if (loading) return <Text>Loading...</Text>;

  return (
    <View>
      <Header title={game.title} />
      <Text>{formatDate(game.scheduledDate)}</Text>
    </View>
  );
}

export default GameDetailScreen;
```

### Naming Conventions

#### Files & Directories

- **Directories:** kebab-case (e.g., `components/game-detail`, `hooks/use-game-detail`)
- **Component files:** PascalCase or matching directory (e.g., `GameCard.tsx` or in `game-card/index.tsx`)
- **Hook files:** lowercase with `.ts` extension (e.g., `useGameDetail.ts`)
- **API files:** domain-based (e.g., `games.ts`, `user.ts`, `stripe.ts`)
- **Test files:** same name + `.test.ts` or `.spec.ts` (e.g., `GameCard.test.tsx`)

#### Variables & Functions

- **Constants:** UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`, `MAX_PLAYERS`)
- **Variables:** camelCase (e.g., `currentUser`, `gameList`)
- **Booleans:** prefix with `is` or `has` (e.g., `isLoading`, `hasError`, `isOrganizer`)
- **Callbacks:** `handle{Action}` or `on{Action}` (e.g., `handleJoinClick`, `onGameUpdate`)
- **Custom hooks:** `use{Feature}` (e.g., `useGameDetail`, `useAuth`)

```typescript
// ✅ Good naming
const DEFAULT_TIMEOUT = 10000;
const maxPlayers = 8;
const isOrganizer = currentUser?.id === game?.organizerId;
const handleSubmit = (): void => { /* ... */ };
function useGameDetail(gameId: string) { /* ... */ }

// ❌ Avoid
const defaultTimeout = 10000; // should be UPPER_CASE
const orgz = user?.id === game?.org_id; // unclear abbreviation
const submit = () => { /* ... */ }; // should be handleSubmit
```

---

## State Management

### Zustand Stores

Zustand is used for global, persistent state. Each store is a separate file.

**Store Template:**

```typescript
// stores/gameStore.ts
import { create } from 'zustand';

interface GameStoreState {
  selectedGameId: string | null;
  setSelectedGameId: (id: string | null) => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  selectedGameId: null,
  setSelectedGameId: (id) => set({ selectedGameId: id }),
}));
```

**Usage in Components:**

```typescript
function GameSelector() {
  const { selectedGameId, setSelectedGameId } = useGameStore();
  return (
    <Pressable onPress={() => setSelectedGameId('game-123')}>
      <Text>{selectedGameId ? 'Game selected' : 'Select game'}</Text>
    </Pressable>
  );
}
```

### React Context

Context is used for provider-level state (Auth, Courses, Location, Notifications).

**Provider Template:**

```typescript
// providers/CustomProvider.tsx
import { createContext, useContext, ReactNode, useState } from 'react';

interface ContextType {
  value: string;
  setValue: (v: string) => void;
}

const Context = createContext<ContextType | undefined>(undefined);

export function CustomProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState('');
  return (
    <Context.Provider value={{ value, setValue }}>
      {children}
    </Context.Provider>
  );
}

export function useCustom() {
  const context = useContext(Context);
  if (!context) {
    throw new Error('useCustom must be used within CustomProvider');
  }
  return context;
}
```

### Local Component State

Use `useState` for single-screen state, `useReducer` for complex state machines.

```typescript
// ✅ Simple state
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// ✅ Complex state → useReducer
interface State {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: Game | null;
  error: string | null;
}

const [state, dispatch] = useReducer(gameReducer, {
  status: 'idle',
  data: null,
  error: null,
});
```

---

## API & Data Fetching

### Axios Configuration

All HTTP requests go through `api/config.ts` which handles:
- Base URL setup
- Default headers (Content-Type, Accept)
- Authorization (Firebase ID token injection)
- Request timeout (10s)

**Usage Pattern:**

```typescript
// api/games.ts
import axios from 'axios';
import { buildApiUrl, DEFAULT_CONFIG } from './config';
import { auth } from '@/firebase.config';

export async function fetchGames(): Promise<Game[]> {
  const token = await auth.currentUser?.getIdToken();
  const config = {
    ...DEFAULT_CONFIG,
    headers: {
      ...DEFAULT_CONFIG.headers,
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = await axios.get(buildApiUrl('games'), config);
  return response.data;
}
```

### Custom Hooks for Data Fetching

Business logic lives in custom hooks (`hooks/`), not components.

**Hook Template:**

```typescript
// hooks/useGameDetail.ts
import { useState, useEffect } from 'react';
import { fetchGameById } from '@/api/games';

interface UseGameDetailReturn {
  game: Game | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGameDetail(gameId: string): UseGameDetailReturn {
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
        if (isMounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false; // cleanup: prevent state update if unmounted
    };
  }, [gameId]);

  return { game, loading, error, refetch: () => load() };
}
```

### Error Handling

- Always use try-catch for async operations
- Provide user-friendly error messages
- Log errors to Sentry for monitoring
- Implement exponential backoff for retries

```typescript
import * as Sentry from '@sentry/react-native';

async function handlePayment(amount: number) {
  try {
    const result = await processPayment(amount);
    return result;
  } catch (err) {
    // Log to Sentry
    Sentry.captureException(err, {
      tags: { feature: 'payment' },
    });

    // Show user-friendly message
    if (err instanceof PaymentError) {
      setError('Payment failed. Please try again.');
    } else {
      setError('An unexpected error occurred. Please try again later.');
    }
  }
}
```

---

## Real-Time Communication (WebSockets)

### Socket.io Integration

Socket.io is used for game chat and direct messaging. Initialize once per app startup, reuse the instance.

**Usage Pattern:**

```typescript
// hooks/useChatSocket.ts
import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';

let socketInstance: Socket | null = null;

function getSocket(userId: string): Socket {
  if (!socketInstance) {
    socketInstance = io(process.env.EXPO_PUBLIC_API_URL, {
      auth: { userId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return socketInstance;
}

export function useChatSocket(gameId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const socket = getSocket(currentUser?.id);

    socket.emit('join_game', { gameId });
    socket.on('message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('message');
    };
  }, [gameId]);

  const sendMessage = (text: string) => {
    socket?.emit('send_message', { gameId, text });
  };

  return { messages, sendMessage };
}
```

---

## Testing Standards

### Test Coverage Threshold

- **Global minimum:** 70% (enforced by Jest)
- **Target:** 75%+ for new code
- **Coverage by category:**
  - Hooks: ≥ 80%
  - Components: ≥ 70%
  - Utils: ≥ 85%

### Test Organization

Tests live in `__tests__/` at the same folder level as the code:

```
hooks/
├── useGameDetail.ts
└── __tests__/
    └── useGameDetail.test.ts

components/
├── GameCard.tsx
└── __tests__/
    └── GameCard.test.tsx
```

### Test Template

```typescript
// __tests__/hooks/useGameDetail.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useGameDetail } from '@/hooks/useGameDetail';

describe('useGameDetail', () => {
  it('should load game data on mount', async () => {
    const { result } = renderHook(() => useGameDetail('game-123'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.game).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('should set error on fetch failure', async () => {
    // Mock API failure
    jest.mock('@/api/games', () => ({
      fetchGameById: jest.fn().mockRejectedValue(new Error('API error')),
    }));

    const { result } = renderHook(() => useGameDetail('game-123'));

    await waitFor(() => {
      expect(result.current.error).toBe('API error');
    });
  });
});
```

### Mocking Strategy

- Mock external APIs with MSW or jest.mock()
- Mock Firebase with jest mocks (see jest.setup.js)
- Don't mock internal modules; test integration instead
- Keep mocks close to where they're used

---

## File Size Management

### Target Line Counts

- **Components:** < 150 lines (split if larger)
- **Hooks:** < 100 lines (split if larger)
- **API files:** < 200 lines (split by domain if needed)
- **Screens:** < 250 lines (use sub-components)

**When to split:**
- Component has > 2 "concern" blocks (data fetch, state, rendering)
- Hook has multiple unrelated useEffects
- Screen renders > 3 major sections

**Refactoring example:**

Instead of:
```typescript
// ❌ 450-line game detail screen
function GameDetailScreen({ gameId }: { gameId: string }) {
  // data fetching, UI rendering, validation, actions all mixed
}
```

Use:
```typescript
// ✅ Separated concerns
function useGameDetail(gameId: string) { /* 50 lines */ }
function GameDetailScreen({ gameId }: { gameId: string }) { /* 100 lines */ }
function GameOrganizerActions() { /* 80 lines */ }
function GamePlayerActions() { /* 80 lines */ }
```

See [`REFACTORING_SUMMARY.md`](../REFACTORING_SUMMARY.md) for the game detail refactor example.

---

## Styling & Design System

### Colors & Tokens

All design tokens live in `constants/` files (colors.ts, sizes.ts, etc.).

```typescript
// constants/colors.ts
export const Colors = {
  light: {
    background: '#FFFFFF',
    text: '#000000',
    primary: '#007AFF',
    danger: '#FF3B30',
    border: '#E5E5EA',
  },
  dark: {
    background: '#000000',
    text: '#FFFFFF',
    primary: '#0A84FF',
    danger: '#FF453A',
    border: '#3A3A3C',
  },
};

// Usage in components
import { useColorScheme } from '@/hooks/useColorScheme';

function GameCard() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return <View style={{ backgroundColor: colors.background }} />;
}
```

### Responsive Design

Use `useWindowDimensions` for responsive layouts, not hardcoded sizes.

```typescript
import { useWindowDimensions } from 'react-native';

function ResponsiveGrid() {
  const { width } = useWindowDimensions();
  const columnCount = width > 600 ? 3 : 2;

  return <FlatList numColumns={columnCount} />;
}
```

---

## Path Aliases

All imports use the `@/` alias pointing to the project root.

```typescript
// ✅ Good
import { useGameDetail } from '@/hooks/useGameDetail';
import { GameCard } from '@/components/GameCard';
import { Games } from '@/stores/gameStore';

// ❌ Avoid relative imports
import { useGameDetail } from '../../../hooks/useGameDetail';
```

**Configured in:**
- `tsconfig.json`: `"@/*": ["./*"]`
- `jest.config.js`: `moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" }`

---

## Comments & Documentation

### When to Comment

- **High-level intent:** Why, not what
- **Workarounds:** Explain non-obvious solutions
- **Business logic:** Domain-specific rules
- **Performance-critical code:** Explain optimization

```typescript
// ✅ Good comments
// Calculate game cost splitting evenly across participants
// Note: Rounding down to avoid overpayment; remainder goes to organizer
const splitCost = Math.floor(totalCost / playerCount);

// Prevent race condition: check game status before processing payment
const currentStatus = await fetchGameStatus(gameId);
if (currentStatus !== 'READY') {
  throw new Error('Game is no longer accepting payments');
}

// ❌ Avoid
const splitCost = Math.floor(totalCost / playerCount); // divide the cost
const status = await fetchGameStatus(gameId); // get status
```

### Documentation Strings

Use JSDoc for public APIs:

```typescript
/**
 * Calculates the split cost for a game among participants.
 * 
 * @param totalCost - Total game cost in cents
 * @param playerCount - Number of players
 * @returns Cost per player in cents (rounded down)
 */
export function calculateSplitCost(totalCost: number, playerCount: number): number {
  return Math.floor(totalCost / playerCount);
}
```

---

## Performance Optimization

### Common Patterns

#### Memoization

Use `useMemo` only when expensive computations are proven to be bottlenecks.

```typescript
const expensiveValue = useMemo(() => {
  return games.filter(g => g.course === selectedCourse).sort((a, b) => {
    return a.scheduledDate.getTime() - b.scheduledDate.getTime();
  });
}, [games, selectedCourse]);
```

#### Callback Memoization

Use `useCallback` to prevent unnecessary re-renders of child components.

```typescript
const handleJoinGame = useCallback((gameId: string) => {
  joinGame(gameId).then(() => refetch());
}, [refetch]); // only recreate if refetch changes

return <GameCard onJoin={handleJoinGame} />;
```

#### List Rendering

Always use `keyExtractor` and render functions for FlatList:

```typescript
<FlatList
  data={games}
  renderItem={({ item }) => <GameCard game={item} />}
  keyExtractor={(item) => item.id}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
/>
```

### Image Optimization

- Use WebP format where supported
- Include size data (width/height) to prevent layout shift
- Lazy-load images from lists

```typescript
<Image
  source={{ uri: imageUrl }}
  style={{ width: 100, height: 100 }}
  resizeMode="cover"
  defaultSource={placeholderImage}
/>
```

---

## Pre-Commit Checklist

Before committing code:

1. **Linting:** `npm run lint` passes
2. **Testing:** `npm test` passes with coverage ≥ 70%
3. **Type safety:** `tsc --noEmit` succeeds
4. **No secrets:** `.env` file not committed
5. **No console:** Remove debug console.log statements
6. **Code review:** Self-review for readability

---

## Versioning & Releases

### Semantic Versioning

Follow SemVer: MAJOR.MINOR.PATCH

- **MAJOR:** Breaking changes (API breaking, incompatible features)
- **MINOR:** New features (backward compatible)
- **PATCH:** Bug fixes

### Version Files

- `package.json`: npm version
- `app.config.js`: Expo app version (match package.json)
- `eas.json`: Build profiles (channels: development, preview, production)

### Release Workflow

1. Update version in `package.json` and `app.config.js`
2. Run `npm test` and `npm run lint`
3. Create git tag: `git tag v1.2.3`
4. Push tag: `git push origin v1.2.3`
5. Trigger EAS build via CI/CD

---

## Accessibility (a11y)

### WCAG 2.1 AA Standards

All interactive components must meet WCAG AA (4.5:1 color contrast minimum for text, keyboard navigation support, screen reader labels).

**Accessibility checklist:**

```typescript
// ✅ Good
<Pressable
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Join game"
  accessibilityHint="Double tap to request to join this game"
  onPress={handleJoin}
>
  <Text>Join</Text>
</Pressable>

// ❌ Avoid
<Pressable onPress={handleJoin}>
  <Text>J</Text> {/* unclear label */}
</Pressable>
```

---

## References

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Style Guide](https://reactnative.dev/docs/style)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

