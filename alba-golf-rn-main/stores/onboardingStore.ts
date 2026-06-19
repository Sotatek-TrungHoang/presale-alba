import { create } from "zustand";
import { GolfCourse } from "@/api/courses";

export type AuthProviderType = "email" | "google" | "apple";

// Define the types for our onboarding state
interface OnboardingState {
  // Auth provider — determines how step7 finalises the signup
  authProvider: AuthProviderType;

  // User credentials (password unused when authProvider === 'google')
  email: string;
  password: string;

  // User information (step 1-3)
  firstName: string;
  lastName: string;
  handicap: string; // 'LOW', 'MID', 'HIGH', 'UNKNOWN'
  playerType: string; // 'CASUAL PLAYER', 'DEDICATED IMPROVER', etc.

  // Preferences (step 4-6)
  matchTypes: string[];
  availability: {
    weekdays: string[];
    weekends: string[];
  };
  selectedCourse: GolfCourse | null;

  // Actions
  setAuthProvider: (provider: AuthProviderType) => void;
  setCredentials: (email: string, password: string) => void;
  setPersonalInfo: (firstName: string, lastName: string) => void;
  setHandicap: (handicap: string) => void;
  setPlayerType: (playerType: string) => void;
  setMatchTypes: (matchTypes: string[]) => void;
  setAvailability: (availability: {
    weekdays: string[];
    weekends: string[];
  }) => void;
  setSelectedCourse: (course: GolfCourse | null) => void;

  // Reset store
  reset: () => void;
}

// Create the store
export const useOnboardingStore = create<OnboardingState>((set) => ({
  // Initial state
  authProvider: "email",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  handicap: "",
  playerType: "",
  matchTypes: [],
  availability: {
    weekdays: ["EARLY_MORNING","LATE_MORNING","LUNCH_TIME","LATE_AFTERNOON","EVENING"],
    weekends: ["EARLY_MORNING","LATE_MORNING","LUNCH_TIME","LATE_AFTERNOON","EVENING"],
  },
  selectedCourse: null,

  // Actions
  setAuthProvider: (authProvider) => set({ authProvider }),
  setCredentials: (email, password) => set({ email, password }),
  setPersonalInfo: (firstName, lastName) => set({ firstName, lastName }),
  setHandicap: (handicap) => set({ handicap }),
  setPlayerType: (playerType) => set({ playerType }),
  setMatchTypes: (matchTypes) => set({ matchTypes }),
  setAvailability: (availability) => set({ availability }),
  setSelectedCourse: (selectedCourse) => set({ selectedCourse }),

  // Reset the store to initial state
  reset: () =>
    set({
      authProvider: "email",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      handicap: "",
      playerType: "",
      matchTypes: [],
      availability: {
        weekdays: ["EARLY_MORNING","LATE_MORNING","LUNCH_TIME","LATE_AFTERNOON","EVENING"],
        weekends: ["EARLY_MORNING","LATE_MORNING","LUNCH_TIME","LATE_AFTERNOON","EVENING"],
      },
      selectedCourse: null,
    }),
}));
