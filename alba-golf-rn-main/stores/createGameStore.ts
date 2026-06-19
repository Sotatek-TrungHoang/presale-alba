import { create } from "zustand";
import { GolfCourse } from "@/api/courses";

// Enums based on your Prisma schema (can be imported or redefined if not directly accessible)
// For simplicity, I'll list them here, but ideally, they come from a shared types/api file.
// export enum TimeSlot {
//   EARLY_MORNING = "EARLY_MORNING",
//   LATE_MORNING = "LATE_MORNING",
//   LUNCHTIME = "LUNCHTIME",
//   LATE_AFTERNOON = "LATE_AFTERNOON",
//   EVENING = "EVENING",
// }

// export enum GameType {
//   PURELY_SOCIAL = "PURELY_SOCIAL",
//   RELAXED_ROUND = "RELAXED_ROUND",
//   COMPETITIVE_MATCH = "COMPETITIVE_MATCH",
//   BEGINNER_FRIENDLY = "BEGINNER_FRIENDLY",
// }

// export enum GameFormat {
//   MATCHPLAY = "MATCHPLAY",
//   STROKEPLAY = "STROKEPLAY",
//   SCRAMBLE = "SCRAMBLE",
//   STABLEFORD = "STABLEFORD",
//   BEST_BALL = "BEST_BALL",
//   DONT_KNOW_YET = "DONT_KNOW_YET",
// }

interface CreateGameState {
  // Game details
  playersNeeded: number | null;
  selectedDate: number | null; // UTC timestamp
  timeSlot: string | null; // Corresponds to TimeSlot enum
  gameType: string | null; // Corresponds to GameType enum
  gameFormat: string | null; // Corresponds to GameFormat enum
  selectedCourse: GolfCourse | null;
  courseLocked: boolean;

  // Actions
  setPlayersNeeded: (players: number | null) => void;
  setSelectedDate: (date: number | null) => void;
  setTimeSlot: (slot: string | null) => void;
  setGameType: (type: string | null) => void;
  setGameFormat: (format: string | null) => void;
  setSelectedCourse: (course: GolfCourse | null) => void;
  setCourseLocked: (locked: boolean) => void;

  // Reset store
  resetCreateGame: () => void;
}

const initialState: Omit<
  CreateGameState,
  | "setPlayersNeeded"
  | "setSelectedDate"
  | "setTimeSlot"
  | "setGameType"
  | "setGameFormat"
  | "setSelectedCourse"
  | "setCourseLocked"
  | "resetCreateGame"
> = {
  playersNeeded: null,
  selectedDate: null,
  timeSlot: null,
  gameType: null,
  gameFormat: null,
  selectedCourse: null,
  courseLocked: false,
};

export const useCreateGameStore = create<CreateGameState>((set) => ({
  ...initialState,

  // Actions
  setPlayersNeeded: (players) => set({ playersNeeded: players }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setTimeSlot: (slot) => set({ timeSlot: slot }),
  setGameType: (type) => set({ gameType: type }),
  setGameFormat: (format) => set({ gameFormat: format }),
  setSelectedCourse: (course) => set({ selectedCourse: course }),
  setCourseLocked: (locked) => set({ courseLocked: locked }),

  // Reset the store to initial state
  resetCreateGame: () => set(initialState),
}));
