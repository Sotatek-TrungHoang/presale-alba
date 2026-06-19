import { Redirect } from "expo-router";

export default function OnboardingIndex() {
  // Redirect to step 1 if someone navigates to /onboarding directly
  return <Redirect href="/onboarding/step1" />;
}
