//app/index.tsx
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Redirect } from "expo-router";

// _layout.tsx's login gate re-checks this on every route change anyway, but
// deciding here too avoids a visible (tabs) -> /login flash for signed-out
// users on cold start.
export default function Index() {
  const { firebaseUser } = useAuth();
  const { completed } = useOnboarding();
  if (firebaseUser) return <Redirect href="/(tabs)" />;
  return <Redirect href={completed ? "/login" : "/onboarding"} />;
}
