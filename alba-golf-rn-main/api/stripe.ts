import axios from "axios";
import { buildApiUrl, DEFAULT_CONFIG } from "./config";
import { auth } from "@/firebase.config";
import { getIdToken } from "firebase/auth";

interface IndividualAccountDetailsForApi {
  email: string;
  phone: string;
  address: {
    city: string;
    line1: string;
    line2?: string;
    postal_code: string;
  };
  dob: {
    day: number;
    month: number;
    year: number;
  };
  first_name: string;
  last_name: string;
}

interface CreateConnectedAccountApiDto {
  email: string;
  individual: IndividualAccountDetailsForApi;
}

interface InitiateOnboardingResponse {
  url: string;
}

interface StripeOnboardingStatusResponse {
  status: "active" | "pending_verification" | "not_started";
  accountType: "EXPRESS" | "CUSTOM" | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  dbStatusMatchesStripe: boolean;
  isReOnboarding: boolean;
}

interface CreateCustomAccountApiDto {
  individual: {
    email: string;
    phone: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      postal_code: string;
    };
    dob: {
      day: number;
      month: number;
      year: number;
    };
    first_name: string;
    last_name: string;
  };
  tos_accepted: true;
}

interface CreateCustomAccountResponse {
  accountId: string;
  requirements: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
    pending_verification?: string[];
    disabled_reason?: string | null;
  } | null;
}

interface AttachExternalAccountResponse {
  externalAccountId: string;
}

export interface StripeRequirementsResponse {
  currently_due: string[];
  eventually_due: string[];
  past_due: string[];
  pending_verification: string[];
  disabled_reason: string | null;
}

const apiClient = axios.create(DEFAULT_CONFIG);

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getFirebaseAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error(
        "Axios Interceptor (Stripe): Failed to get auth token for request:",
        error
      );
      throw new Error("Failed to attach auth token for Stripe API call");
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const getFirebaseAuthToken = async (
  forceRefresh: boolean = false
): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error("getFirebaseAuthToken: No user currently authenticated.");
    throw new Error("Authentication required. Please log in.");
  }
  try {
    const idToken = await getIdToken(currentUser, forceRefresh);
    return idToken;
  } catch (error) {
    console.error("getFirebaseAuthToken: Error getting ID token:", error);
    throw new Error("Could not verify authentication. Please log in again.");
  }
};

// --- API Functions --- //

export const initiateStripeOnboarding = async (
  data: CreateConnectedAccountApiDto
): Promise<InitiateOnboardingResponse> => {
  try {
    console.log(
      "Initiating Stripe onboarding with data:",
      JSON.stringify(data, null, 2)
    );

    const response = await apiClient.post<InitiateOnboardingResponse>(
      buildApiUrl("stripe/onboarding/initiate"), // Use buildApiUrl
      data
    );

    console.log("Stripe onboarding initiated successfully:", response.data);
    return response.data;
  } catch (error: unknown) {
    console.error("Error initiating Stripe onboarding:", error);

    if (axios.isAxiosError(error) && error.response) {
      // Handle specific backend errors
      console.error("Backend error data:", error.response.data);
      throw new Error(
        error.response.data?.message ||
          "Failed to start Stripe onboarding via backend."
      );
    } else if (error instanceof Error) {
      // Handle other errors (like no auth token)
      throw error;
    } else {
      // Fallback for unknown errors
      throw new Error(
        "An unexpected error occurred while starting Stripe onboarding."
      );
    }
  }
};

export const getStripeOnboardingStatus =
  async (): Promise<StripeOnboardingStatusResponse> => {
    try {
      const response = await apiClient.get<StripeOnboardingStatusResponse>(
        buildApiUrl("stripe/onboarding/status") // Endpoint for status
      );

      return response.data;
    } catch (error: unknown) {
      console.error("Error fetching Stripe onboarding status:", error);

      if (axios.isAxiosError(error) && error.response) {
        // Handle specific backend errors
        console.error("Backend error data:", error.response.data);
        throw new Error(
          error.response.data?.message ||
            "Failed to fetch Stripe onboarding status from backend."
        );
      } else if (error instanceof Error) {
        // Handle other errors (like no auth token)
        throw error;
      } else {
        // Fallback for unknown errors
        throw new Error(
          "An unexpected error occurred while fetching Stripe onboarding status."
        );
      }
    }
  };

export const createStripeCustomAccount = async (
  data: CreateCustomAccountApiDto
): Promise<CreateCustomAccountResponse> => {
  try {
    const response = await apiClient.post<CreateCustomAccountResponse>(
      buildApiUrl("stripe/onboarding/account"),
      data
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("createStripeCustomAccount backend error:", error.response.data);
      throw new Error(
        error.response.data?.message || "Failed to create Stripe account."
      );
    }
    if (error instanceof Error) throw error;
    throw new Error("Unexpected error creating Stripe account.");
  }
};

export const attachStripeExternalAccount = async (
  bankToken: string
): Promise<AttachExternalAccountResponse> => {
  try {
    const response = await apiClient.post<AttachExternalAccountResponse>(
      buildApiUrl("stripe/onboarding/external-account"),
      { bank_token: bankToken }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("attachStripeExternalAccount backend error:", error.response.data);
      throw new Error(
        error.response.data?.message || "Failed to attach bank account."
      );
    }
    if (error instanceof Error) throw error;
    throw new Error("Unexpected error attaching bank account.");
  }
};

export interface UpdateIndividualPayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  dob?: { day: number; month: number; year: number };
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    postal_code?: string;
  };
}

export const updateStripeIndividual = async (
  payload: UpdateIndividualPayload
): Promise<{ requirements: StripeRequirementsResponse | null }> => {
  try {
    const response = await apiClient.post<{
      requirements: StripeRequirementsResponse | null;
    }>(buildApiUrl("stripe/onboarding/individual"), payload);
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("updateStripeIndividual backend error:", error.response.data);
      throw new Error(
        error.response.data?.message || "Failed to update your details."
      );
    }
    if (error instanceof Error) throw error;
    throw new Error("Unexpected error updating your details.");
  }
};

export interface UploadIdentityDocumentParams {
  fileUri: string;
  fileName: string;
  mimeType: string;
  side: "front" | "back";
  slot?: "document" | "additional_document";
}

export const uploadStripeIdentityDocument = async (
  params: UploadIdentityDocumentParams
): Promise<{
  fileId: string;
  requirements: StripeRequirementsResponse | null;
}> => {
  const formData = new FormData();
  // React Native FormData accepts this shape for file uploads; the
  // `as any` cast is unavoidable because TS expects Blob | string.
  formData.append("file", {
    uri: params.fileUri,
    name: params.fileName,
    type: params.mimeType,
  } as any);
  formData.append("file_name", params.fileName);
  formData.append("side", params.side);
  if (params.slot) formData.append("slot", params.slot);

  try {
    const response = await apiClient.post<{
      fileId: string;
      requirements: StripeRequirementsResponse | null;
    }>(buildApiUrl("stripe/onboarding/document"), formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        "uploadStripeIdentityDocument backend error:",
        error.response.data
      );
      throw new Error(
        error.response.data?.message ||
          "Failed to upload your identity document."
      );
    }
    if (error instanceof Error) throw error;
    throw new Error("Unexpected error uploading document.");
  }
};

export const getStripeOnboardingRequirements =
  async (): Promise<StripeRequirementsResponse> => {
    try {
      const response = await apiClient.get<StripeRequirementsResponse>(
        buildApiUrl("stripe/onboarding/requirements")
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        console.error(
          "getStripeOnboardingRequirements backend error:",
          error.response.data
        );
        throw new Error(
          error.response.data?.message ||
            "Failed to fetch onboarding requirements."
        );
      }
      if (error instanceof Error) throw error;
      throw new Error("Unexpected error fetching onboarding requirements.");
    }
  };

// Add fetch function for publishable key
export interface PublishableKeyResponse {
  publishableKey: string;
}

/**
 * Retrieves Stripe publishable key from backend so that the client can initialise Stripe SDK
 * without hard-coding the key in the app bundle. The endpoint is expected to be public and
 * should not require authentication.
 */
export const fetchStripePublishableKey = async (): Promise<string> => {
  try {
    // First try to get from environment variable
    const envKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (envKey && envKey !== 'pk_test_your_stripe_key_here') {
      return envKey;
    }

    // If no env key, try to fetch from backend
    const response = await axios.get<PublishableKeyResponse>(
      buildApiUrl("stripe/publishable-key")
    );
    return response.data.publishableKey;
  } catch (error: unknown) {
    console.error("Error fetching Stripe publishable key:", error);

    // If backend fails, return a test key as fallback
    console.warn("Using fallback Stripe test key");
    return "pk_test_51234567890abcdef"; // Fallback test key
  }
};
