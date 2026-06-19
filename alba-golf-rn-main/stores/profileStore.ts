import { create } from "zustand";
import { getUser } from "@/api/user"; // Adjust path as needed

// Define a type for your backend user profile (replace 'any' with your actual type)
// You might have this in api/user.ts or a shared types file
type UserProfile = any;

interface ProfileState {
  profile: UserProfile | null;
  loadingProfile: boolean;
  profileError: string | null;
  fetchProfile: () => Promise<void>;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loadingProfile: false, // Start as false, loading triggered by AuthProvider
  profileError: null,

  fetchProfile: async () => {
    set({ loadingProfile: true, profileError: null });
    try {
      const userProfileData = await getUser();
      set({ profile: userProfileData, loadingProfile: false });
    } catch (error: any) {
      console.error("ProfileStore: Failed to fetch user profile:", error);
      set({
        profileError: error.message || "Failed to load profile.",
        profile: null,
        loadingProfile: false,
      });
      // Unlike the combined approach, we probably DON'T auto-logout here,
      // as the auth state is managed separately.
    } finally {
      // Ensure loading is false even if getUser doesn't throw but fails somehow
      set((state) => ({ ...state, loadingProfile: false }));
    }
  },

  clearProfile: () => {
    set({ profile: null, loadingProfile: false, profileError: null });
  },
}));
