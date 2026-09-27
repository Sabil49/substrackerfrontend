// app/_layout.tsx
import { LoadingScreen } from "@/components/BrandLoader";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { Subscription, subscriptionsApi, testApiConnectivity } from "@/services/api";
import { dataCache } from "@/services/dataCache";
import {
  configureNotificationHandler,
  registerForPushNotifications,
  syncLocalReminders,
} from "@/services/notifications";
import { syncPremiumEntitlement } from "@/services/premium";
import { hasOptedOutOfNotifications } from "@/utils/storage";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

// Shows expo-router's error screen (message + Try Again) if any screen throws
// while rendering, instead of letting the error take the whole app down.
export { ErrorBoundary } from "expo-router";

// Routes reachable while signed out. Everything else requires auth.
const PUBLIC_ROUTES = ["login", "signup", "forgot-password"];

function RootLayoutContent() {
  const { colors } = useTheme();
  const { firebaseUser, initializing: authInitializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    configureNotificationHandler();
    // Warm the backend in the background. The app never waits for it — it used
    // to, which held the whole app on a blank screen at every launch.
    testApiConnectivity().catch(() => {});
  }, []);

  // These need an authenticated caller now that guest mode is gone, so they
  // run once sign-in resolves rather than at cold start. Delayed a couple
  // seconds past that so IAP/push native-module init doesn't compete with
  // the app's own launch — a suspected trigger for the early-launch native
  // crash class documented in facebook/react-native#54859 and similar
  // issues (an uncaught exception from a native module during startup).
  useEffect(() => {
    if (!firebaseUser) return;
    const timer = setTimeout(async () => {
      syncPremiumEntitlement();
      try {
        // Respect a user who turned notifications off in Account.
        if (!(await hasOptedOutOfNotifications())) {
          await registerForPushNotifications();
          // Permission has just been answered: schedule renewal reminders now
          // rather than waiting for the next time the list is refreshed.
          const cached = dataCache.get<Subscription[]>("subscriptions");
          const subscriptions = cached?.data ?? (await subscriptionsApi.getAll());
          if (!cached) dataCache.set("subscriptions", subscriptions);
          await syncLocalReminders(subscriptions);
        }
      } catch (error) {
        console.log("Push notification init error:", error);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [firebaseUser]);

  // Hard login gate: no guest browsing anywhere in the app.
  useEffect(() => {
    if (authInitializing) return;
    const onPublicRoute = PUBLIC_ROUTES.includes(segments[0] as string);
    if (!firebaseUser && !onPublicRoute) {
      router.replace("/login");
    } else if (firebaseUser && onPublicRoute) {
      router.replace("/(tabs)");
    }
  }, [authInitializing, firebaseUser, segments, router]);

  if (authInitializing) {
    return (
      <>
        <StatusBar style="light" />
        <LoadingScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background.primary,
          },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="subscription/[id]" />
        <Stack.Screen name="add-subscription" />
        <Stack.Screen name="import-subscription" />
        <Stack.Screen name="premium" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </ThemeProvider>
  );
}


