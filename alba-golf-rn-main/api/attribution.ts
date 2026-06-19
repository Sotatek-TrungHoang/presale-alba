import axios from "axios";
import { getIdToken } from "firebase/auth";
import { buildApiUrl, DEFAULT_CONFIG } from "./config";
import { auth } from "@/firebase.config";
import type { Attribution } from "@/utils/attribution";

const apiClient = axios.create(DEFAULT_CONFIG);

// Attach the Firebase ID token when a user is signed in (mirrors api/user.ts).
apiClient.interceptors.request.use(
  async (config) => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await getIdToken(currentUser);
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface AttributionPayload {
  /** How the user registered: "email" | "google" | "apple" | ... */
  method: string;
  /** The campaign / link that first brought this install in. */
  firstTouch: Attribution | null;
  /** The most recent campaign / link touch before signup. */
  lastTouch: Attribution | null;
}

/**
 * Persist the signup attribution against the authenticated user.
 *
 * Best-effort: errors propagate to the caller (which logs to Sentry) but must
 * never block the signup flow.
 */
export const postAttribution = async (
  payload: AttributionPayload
): Promise<void> => {
  await apiClient.post(buildApiUrl("attribution"), payload);
};
