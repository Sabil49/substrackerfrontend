// app/_layout.tsx
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { testApiConnectivity } from "@/services/api";
import { configureNotificationHandler, registerForPushNotifications } from "@/services/notifications";
import { syncPremiumEntitlement } from "@/services/premium";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

// Routes reachable while signed out. Everything else requires auth.
const PUBLIC_ROUTES = ["login", "signup", "forgot-password"];

function RootLayoutContent() {
  const [isReady, setIsReady] = useState(false);
  const { colors } = useTheme();
  const { firebaseUser, initializing: authInitializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    configureNotificationHandler();
    async function initializeApp() {
      try {
        const isApiReachable = await testApiConnectivity();
        if (!isApiReachable) {
          console.warn(
            "⚠️ API may not be reachable - app will work in offline mode",
          );
        }
      } catch (error) {
        console.error("Failed to reach Cloud Functions:", error);
        // Continue anyway — subscriptions screen will show error state
      } finally {
        setIsReady(true);
      }
    }

    initializeApp();
  }, []);

  // These need an authenticated caller now that guest mode is gone, so they
  // run once sign-in resolves rather than at cold start. Delayed a couple
  // seconds past that so IAP/push native-module init doesn't compete with
  // the app's own launch — a suspected trigger for the early-launch native
  // crash class documented in facebook/react-native#54859 and similar
  // issues (an uncaught exception from a native module during startup).
  useEffect(() => {
    if (!firebaseUser) return;
    const timer = setTimeout(() => {
      syncPremiumEntitlement();
      registerForPushNotifications().catch((error) =>
        console.log("Push notification init error:", error),
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [firebaseUser]);

  // Hard login gate: no guest browsing anywhere in the app.
  useEffect(() => {
    if (!isReady || authInitializing) return;
    const onPublicRoute = PUBLIC_ROUTES.includes(segments[0] as string);
    if (!firebaseUser && !onPublicRoute) {
      router.replace("/login");
    } else if (firebaseUser && onPublicRoute) {
      router.replace("/(tabs)");
    }
  }, [isReady, authInitializing, firebaseUser, segments, router]);

  if (!isReady || authInitializing) {
    return (
      <View
        style={[styles.loading, { backgroundColor: colors.background.primary }]}
      >
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

