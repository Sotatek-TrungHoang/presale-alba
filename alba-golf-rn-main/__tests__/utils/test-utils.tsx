import React from "react";
import { render, RenderOptions } from "@testing-library/react-native";
import { GameDetail } from "@/hooks/useGameDetail";

// Mock data for testing
export const mockGame: GameDetail = {
  id: "game-123",
  creator_id: "creator-123",
  creator: {
    id: "creator-123",
    profile: {
      first_name: "John",
      last_name: "Doe",
      photo: "https://example.com/photo.jpg",
    },
  },
  date: "2024-01-15",
  time_slot: "MORNING",
  players_current: 3,
  players_needed: 4,
  course_id: "course-123",
  course: {
    id: "course-123",
    name: "Test Golf Course",
    booking_url: "https://example.com/booking",
  },
  game_type: "CASUAL",
  game_format: "STROKEPLAY",
  players: [
    {
      user_id: "player-1",
      user: {
        id: "player-1",
        profile: {
          first_name: "Alice",
          last_name: "Smith",
          photo: "https://example.com/alice.jpg",
        },
        onboarding: {
          handicap_range: "10-15",
        },
      },
      status: "CONFIRMED",
      has_paid: true,
    },
    {
      user_id: "player-2",
      user: {
        id: "player-2",
        profile: {
          first_name: "Bob",
          last_name: "Johnson",
          photo: "https://example.com/bob.jpg",
        },
        onboarding: {
          handicap_range: "5-10",
        },
      },
      status: "APPROVED",
      has_paid: false,
    },
  ],
  conversation: {
    id: "conv-123",
  },
  status: "PLAYERS_REQUIRED",
  exact_time: "09:00",
  cost_per_player: 50,
};

export const mockProfile = {
  id: "user-123",
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
  phone: "+1234567890",
  handicap_range: "10-15",
  photo: "https://example.com/test.jpg",
};

// Custom render function with providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <>{children}</>;
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from "@testing-library/react-native";

// Override render method
export { customRender as render };

// Mock API responses
export const mockApiResponses = {
  game: {
    success: mockGame,
    error: { message: "Failed to fetch game" },
  },
  payment: {
    success: { success: true, payment_intent_id: "pi_123" },
    error: { message: "Payment failed" },
  },
};

// Mock navigation
export const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getState: jest.fn(() => ({
    routes: [{ name: "Test" }],
    index: 0,
  })),
};

// Mock route
export const mockRoute = {
  params: {
    gameId: "game-123",
  },
  name: "TestScreen",
  key: "test-key",
};

// Utility functions for testing
export const waitForAsync = (ms: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const createMockEvent = (value: string) => ({
  nativeEvent: { text: value },
  target: { value },
});

export const mockAlert = {
  alert: jest.fn(),
};

// Mock AsyncStorage
export const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
};
