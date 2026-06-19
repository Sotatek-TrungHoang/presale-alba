import { createContext, useEffect, useState, useContext } from "react";
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  User,
  getIdToken,
  verifyPasswordResetCode,
} from "firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { auth } from "../firebase.config"; // Adjust path if needed
// Import the new API function and types
import {
  signupWithOnboarding,
  CreateUserWithOnboardingDto,
  deleteCurrentUserAccount,
} from "@/api/user";
// Import the Zustand store for profile management
import { useProfileStore } from "@/stores/profileStore"; // Adjust path
import { logCompletedRegistration } from "@/utils/analytics";
import {
  getCampaignParams,
  reportSignupAttribution,
} from "@/utils/attribution";
import { AppState } from "react-native";
import React, { useRef } from "react";

export type GoogleSignInResult =
  | { needsOnboarding: false }
  | {
      needsOnboarding: true;
      prefill: { email: string; firstName: string; lastName: string };
    };

export type AppleSignInResult =
  | { needsOnboarding: false }
  | {
      needsOnboarding: true;
      prefill: { email: string; firstName: string; lastName: string };
    };

// Helper function to translate Firebase errors to user-friendly messages
const getAuthErrorMessage = (error: any): string => {
  // Handle Firebase Auth errors
  if (error?.code) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "An account with this email address already exists. Please try signing in instead.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password should be at least 6 characters long.";
      case "auth/user-not-found":
        return "No account found with this email address. Please check your email or create a new account.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/network-request-failed":
        return "Network error. Please check your internet connection and try again.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact support.";
      case "auth/invalid-credential":
        return "Invalid email or password. Please try again.";
      default:
        return "Authentication failed. Please try again.";
    }
  }

  // Handle generic errors
  if (error?.message) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
};

// Define the context type
type AuthContextType = {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<GoogleSignInResult>;
  loginWithApple: () => Promise<AppleSignInResult>;
  register: (
    email: string,
    password: string,
    onboardingDetails: Omit<
      CreateUserWithOnboardingDto,
      "auth_id" | "email" | "admin_status" | "password"
    >
  ) => Promise<void>;
  completeSocialOnboarding: (
    onboardingDetails: Omit<
      CreateUserWithOnboardingDto,
      "auth_id" | "email" | "admin_status"
    >
  ) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>; // new
  sendPasswordReset: (email: string) => Promise<void>;
  verifyPasswordResetCode: (oobCode: string) => Promise<string>;
  confirmPasswordReset: (oobCode: string, newPassword: string) => Promise<void>;
};

// Provide a default value matching the type
export const AuthContext = createContext<AuthContextType>({
  user: null,
  initializing: true,
  login: async () => {},
  loginWithGoogle: async () => ({ needsOnboarding: false }),
  loginWithApple: async () => ({ needsOnboarding: false }),
  register: async () => {},
  completeSocialOnboarding: async () => {},
  logout: async () => {},
  deleteAccount: async () => {},
  sendPasswordReset: async () => {},
  verifyPasswordResetCode: async () => "",
  confirmPasswordReset: async () => {},
});

// Custom hook to consume the AuthContext
export function useAuth() {
  return useContext(AuthContext);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Set an initializing state whilst Firebase connects
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Ref for latest initializing value
  const initializingRef = useRef(initializing);
  useEffect(() => {
    initializingRef.current = initializing;
  }, [initializing]);

  // Get profile store actions (outside useEffect for stability if needed, though getState is safe)
  // Note: Using getState() inside useEffect is often preferred to avoid adding store actions to dependency arrays

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });

    // Get actions from Zustand store inside useEffect to ensure latest state access
    // or use useProfileStore.getState() directly if preferred
    // const { fetchProfile, clearProfile } = useProfileStore.getState(); // Actions can be fetched here or directly via getState() inside the callback

    const unsubscribeAuthStateChanged = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        // Make async
        setUser(firebaseUser);

        // Get the latest store actions directly here to ensure freshness in the callback scope
        const storeActions = useProfileStore.getState();

        if (firebaseUser) {
          // User is signed in, or has just signed up.
          // Explicitly clear any existing profile from the store before fetching the new one.
          // This helps prevent showing stale data from a previous session, especially after a quick logout and new signup.
          storeActions.clearProfile();

          try {
            await storeActions.fetchProfile(); // Call Zustand action
          } catch (error) {
            console.error(
              "AuthProvider: Failed to get ID token or fetch profile:",
              error
            );
            // storeActions.clearProfile() was already called.
            // fetchProfile in profileStore should also set profile to null on error.
          }
        } else {
          // User is signed out, clear profile via Zustand store
          storeActions.clearProfile();
        }

        // Mark Firebase initialization complete
        if (initializingRef.current) {
          setInitializing(false);
        }
      }
    );

    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === "active") {
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            await useProfileStore.getState().fetchProfile();
          } catch (error) {
            console.error(
              "AuthProvider: Failed to refresh profile on app focus:",
              error
            );
          }
        }
      }
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    // Cleanup listeners on unmount
    return () => {
      unsubscribeAuthStateChanged();
      appStateSubscription.remove();
    };
  }, []); // Only run once on mount/unmount

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged listener above will handle triggering profile fetch
    } catch (e: any) {
      console.error("Login failed:", e);
      // Create a new error with a user-friendly message
      const userFriendlyError = new Error(getAuthErrorMessage(e));
      userFriendlyError.name = e?.code || "auth/unknown";
      throw userFriendlyError;
    }
  };

  const register = async (
    email: string,
    password: string,
    onboardingDetails: Omit<
      CreateUserWithOnboardingDto,
      "auth_id" | "email" | "admin_status" | "name"
    > & { first_name: string; last_name: string } // Ensure name is passed in
  ) => {
    try {
      // 1. Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        throw new Error("Firebase user creation failed.");
      }

      // 2. Prepare payload for backend
      const backendPayload: CreateUserWithOnboardingDto = {
        ...onboardingDetails,
        auth_id: firebaseUser.uid,
        email: email,
        admin_status: false,
      };

      // 3. Call backend API to create user and save onboarding data
      await signupWithOnboarding(backendPayload);

      // Report the conversion to Meta for ad attribution, tagged with the
      // campaign that drove the install, and persist the attribution server-side.
      const campaign = await getCampaignParams();
      logCompletedRegistration("email", campaign);
      void reportSignupAttribution("email");

      // --- NEW: Fetch profile immediately after successful backend signup ---
      try {
        // Using Zustand store action directly to ensure profile is available
        await useProfileStore.getState().fetchProfile();
      } catch (fetchError) {
        // If fetching the profile fails here, we already have the user logged in.
        // The onAuthStateChanged listener will attempt again on the next state/event.
        console.error(
          "register: Failed to fetch profile after onboarding signup:",
          fetchError
        );
      }

      // User is registered in Firebase and backend.
      // The onAuthStateChanged listener will detect the new user and may also trigger profile fetch.
    } catch (e: any) {
      console.error("Registration failed:", e);
      // Create a new error with a user-friendly message
      const userFriendlyError = new Error(getAuthErrorMessage(e));
      userFriendlyError.name = e?.code || "auth/unknown";
      throw userFriendlyError;
    }
  };

  const loginWithGoogle = async (): Promise<GoogleSignInResult> => {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const response = await GoogleSignin.signIn();

      if (response.type !== "success") {
        const cancelled = new Error("Google sign-in was cancelled.");
        cancelled.name = "auth/google-cancelled";
        throw cancelled;
      }

      const { idToken, user: googleUser } = response.data;
      if (!idToken) {
        throw new Error("Google sign-in did not return an ID token.");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      // Determine whether the user has an existing backend profile.
      // onAuthStateChanged will also trigger a fetch, but we await one here
      // so the caller can route to onboarding or home synchronously.
      await useProfileStore.getState().fetchProfile();
      const profile = useProfileStore.getState().profile;

      if (profile) {
        return { needsOnboarding: false };
      }

      return {
        needsOnboarding: true,
        prefill: {
          email: googleUser.email ?? firebaseUser.email ?? "",
          firstName: googleUser.givenName ?? "",
          lastName: googleUser.familyName ?? "",
        },
      };
    } catch (e: any) {
      if (
        e?.code === statusCodes.SIGN_IN_CANCELLED ||
        e?.name === "auth/google-cancelled"
      ) {
        const cancelled = new Error("Sign-in was cancelled.");
        cancelled.name = "auth/google-cancelled";
        throw cancelled;
      }
      console.error("Google sign-in failed:", e);
      const userFriendlyError = new Error(getAuthErrorMessage(e));
      userFriendlyError.name = e?.code || "auth/google-failed";
      throw userFriendlyError;
    }
  };

  const loginWithApple = async (): Promise<AppleSignInResult> => {
    try {
      if (Platform.OS !== "ios") {
        throw new Error("Apple sign-in is only available on iOS.");
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error("Apple sign-in is not available on this device.");
      }

      // Firebase requires the raw nonce; Apple is given the SHA-256 hash.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error("Apple sign-in did not return an identity token.");
      }

      const oauthCredential = new OAuthProvider("apple.com").credential({
        idToken: credential.identityToken,
        rawNonce,
      });
      const userCredential = await signInWithCredential(auth, oauthCredential);
      const firebaseUser = userCredential.user;

      await useProfileStore.getState().fetchProfile();
      const profile = useProfileStore.getState().profile;

      if (profile) {
        return { needsOnboarding: false };
      }

      // Apple only returns email/name on the first sign-in. If we ever
      // re-enter onboarding without those, fall back to whatever Firebase has.
      return {
        needsOnboarding: true,
        prefill: {
          email: credential.email ?? firebaseUser.email ?? "",
          firstName: credential.fullName?.givenName ?? "",
          lastName: credential.fullName?.familyName ?? "",
        },
      };
    } catch (e: any) {
      // expo-apple-authentication throws ERR_REQUEST_CANCELED on user cancel.
      if (e?.code === "ERR_REQUEST_CANCELED") {
        const cancelled = new Error("Sign-in was cancelled.");
        cancelled.name = "auth/apple-cancelled";
        throw cancelled;
      }
      console.error("Apple sign-in failed:", e);
      const userFriendlyError = new Error(getAuthErrorMessage(e));
      userFriendlyError.name = e?.code || "auth/apple-failed";
      throw userFriendlyError;
    }
  };

  const completeSocialOnboarding = async (
    onboardingDetails: Omit<
      CreateUserWithOnboardingDto,
      "auth_id" | "email" | "admin_status"
    >
  ) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Not authenticated. Please sign in again.");
      }

      const backendPayload: CreateUserWithOnboardingDto = {
        ...onboardingDetails,
        auth_id: currentUser.uid,
        email: currentUser.email ?? "",
        admin_status: false,
      };

      await signupWithOnboarding(backendPayload);

      // Report the conversion to Meta for ad attribution. Derive the provider
      // (google.com / apple.com) so the registration method is meaningful.
      const providerId = currentUser.providerData[0]?.providerId;
      const method =
        providerId === "google.com"
          ? "google"
          : providerId === "apple.com"
            ? "apple"
            : "social";
      const campaign = await getCampaignParams();
      logCompletedRegistration(method, campaign);
      void reportSignupAttribution(method);

      try {
        await useProfileStore.getState().fetchProfile();
      } catch (fetchError) {
        console.error(
          "completeSocialOnboarding: Failed to fetch profile after signup:",
          fetchError
        );
      }
    } catch (e: any) {
      console.error("Social onboarding completion failed:", e);
      const userFriendlyError = new Error(getAuthErrorMessage(e));
      userFriendlyError.name = e?.code || "auth/unknown";
      throw userFriendlyError;
    }
  };

  const logout = async () => {
    try {
      try {
        await GoogleSignin.signOut();
      } catch (googleErr) {
        // Non-fatal: user may not have signed in with Google this session.
        console.warn("Google sign-out skipped:", googleErr);
      }
      await signOut(auth);
      // onAuthStateChanged listener will handle clearing profile via Zustand
    } catch (e) {
      console.error("Logout failed:", e);
      throw e; // Re-throw to handle in UI
    }
  };

  const deleteAccount = async () => {
    try {
      await deleteCurrentUserAccount();
      await signOut(auth); // sign out locally after backend deletion
    } catch (e) {
      console.error("Delete account failed:", e);
      throw e;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e: any) {
      // Swallow user-not-found so we don't leak which emails are registered.
      // The UI shows a generic "if an account exists, we've sent a link" message.
      if (e?.code === "auth/user-not-found") return;
      console.error("Password reset failed:", e);
      const userFriendlyError = new Error(getAuthErrorMessage(e));
      userFriendlyError.name = e?.code || "auth/unknown";
      throw userFriendlyError;
    }
  };

  const verifyResetCode = async (oobCode: string): Promise<string> => {
    try {
      return await verifyPasswordResetCode(auth, oobCode);
    } catch (e: any) {
      console.error("Verify reset code failed:", e);
      const userFriendlyError = new Error(getAuthErrorMessage(e));
      userFriendlyError.name = e?.code || "auth/unknown";
      throw userFriendlyError;
    }
  };

  const confirmReset = async (oobCode: string, newPassword: string) => {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
    } catch (e: any) {
      console.error("Confirm password reset failed:", e);
      const userFriendlyError = new Error(getAuthErrorMessage(e));
      userFriendlyError.name = e?.code || "auth/unknown";
      throw userFriendlyError;
    }
  };

  // Provide only the core Auth state and functions
  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        login,
        loginWithGoogle,
        loginWithApple,
        register,
        completeSocialOnboarding,
        logout,
        deleteAccount,
        sendPasswordReset,
        verifyPasswordResetCode: verifyResetCode,
        confirmPasswordReset: confirmReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
