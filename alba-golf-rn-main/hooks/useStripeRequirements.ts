import { useCallback, useEffect, useState } from "react";
import {
  getStripeOnboardingRequirements,
  StripeRequirementsResponse,
} from "@/api/stripe";
import { useAuth } from "@/hooks/useAuth";

interface State {
  loading: boolean;
  requirements: StripeRequirementsResponse | null;
  error: Error | null;
}

// Returns the user's outstanding Stripe Connect requirements. Safe to call for
// any user: returns empty/zero counts when there's no Stripe account yet (the
// backend 404s and we swallow it so the home screen doesn't crash).
export function useStripeRequirements() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({
    loading: true,
    requirements: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ loading: false, requirements: null, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const requirements = await getStripeOnboardingRequirements();
      setState({ loading: false, requirements, error: null });
    } catch (err) {
      // Most likely the user has no Stripe account yet; treat as zero
      // outstanding requirements rather than surfacing as an error.
      setState({ loading: false, requirements: null, error: err as Error });
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const outstandingCount = state.requirements?.currently_due.length ?? 0;
  const pastDueCount = state.requirements?.past_due.length ?? 0;

  return {
    loading: state.loading,
    requirements: state.requirements,
    outstandingCount,
    pastDueCount,
    error: state.error,
    refresh,
  };
}
