// app/contexts/OnboardingContext.tsx
import { isOnboardingCompleted, setOnboardingCompleted } from "@/utils/storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// Whether this device has seen the intro screens. Kept in context (not just
// storage) so the login gate learns the moment onboarding is finished and
// doesn't send the user straight back to it.
type OnboardingContextType = {
  ready: boolean;
  completed: boolean;
  complete: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    isOnboardingCompleted()
      .then(setCompleted)
      .catch(() => setCompleted(true)) // storage failed: never block the app on intro screens
      .finally(() => setReady(true));
  }, []);

  const complete = useCallback(async () => {
    setCompleted(true);
    await setOnboardingCompleted().catch(() => {});
  }, []);

  return (
    <OnboardingContext.Provider value={{ ready, completed, complete }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return context;
}
