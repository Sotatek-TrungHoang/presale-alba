import { create } from "zustand";
import { useProfileStore } from "./profileStore";

// Define the structure based on CreateConnectedAccountDto
interface IndividualAccountDetails {
  email: string;
  phone: string;
  address: {
    city: string;
    line1: string;
    line2: string;
    postal_code: string;
  };
  dob: {
    day: number | null;
    month: number | null;
    year: number | null;
  };
  first_name: string;
  last_name: string;
}

type StripeOnboardingState = {
  step: number;
  setStep: (step: number) => void;
  email: string;
  setEmail: (email: string) => void;
  individual: IndividualAccountDetails;
  showAddressSheet: boolean;
  setShowAddressSheet: (show: boolean) => void;

  // Native Custom onboarding state. Lives in the store so the user can bail
  // and resume mid-flow without restarting; reset on flow completion.
  tosAccepted: boolean;
  setTosAccepted: (accepted: boolean) => void;
  stripeAccountId: string | null;
  setStripeAccountId: (id: string | null) => void;
  resetOnboarding: () => void;

  setIndividualField: <K extends keyof IndividualAccountDetails>(
    field: K,
    value: IndividualAccountDetails[K]
  ) => void;
  setIndividualAddressField: <
    K extends keyof IndividualAccountDetails["address"]
  >(
    field: K,
    value: IndividualAccountDetails["address"][K]
  ) => void;
  setIndividualDobField: <K extends keyof IndividualAccountDetails["dob"]>(
    field: K,
    value: IndividualAccountDetails["dob"][K]
  ) => void;
  syncWithProfile: () => void;
};

export const useStripeOnboardingStore = create<StripeOnboardingState>(
  (set, get) => ({
    // Step tracking
    step: 1,
    setStep: (step) => set({ step }),

    // New state for connected account
    email: "",
    setEmail: (email) => set({ email }),

    // Modal control
    showAddressSheet: false,
    setShowAddressSheet: (show) => set({ showAddressSheet: show }),

    // Native onboarding state
    tosAccepted: false,
    setTosAccepted: (accepted) => set({ tosAccepted: accepted }),
    stripeAccountId: null,
    setStripeAccountId: (id) => set({ stripeAccountId: id }),
    resetOnboarding: () =>
      set({
        step: 1,
        tosAccepted: false,
        stripeAccountId: null,
      }),

    individual: {
      email: "",
      phone: "",
      address: {
        city: "",
        line1: "",
        line2: "",
        postal_code: "",
      },
      dob: {
        day: null,
        month: null,
        year: null,
      },
      first_name: "",
      last_name: "",
    },

    // Actions to update individual fields
    setIndividualField: (field, value) =>
      set((state) => ({
        individual: { ...state.individual, [field]: value },
      })),

    setIndividualAddressField: (field, value) =>
      set((state) => ({
        individual: {
          ...state.individual,
          address: { ...state.individual.address, [field]: value },
        },
      })),

    setIndividualDobField: (field, value) =>
      set((state) => ({
        individual: {
          ...state.individual,
          dob: { ...state.individual.dob, [field]: value },
        },
      })),

    // Sync with profile store
    syncWithProfile: () => {
      const profileStore = useProfileStore.getState();
      const profile = profileStore.profile;

      if (profile?.email) {
        set((state) => ({
          email: profile.email,
          individual: {
            ...state.individual,
            email: profile.email,
          },
        }));
      }
    },
  })
);
