// app/_layout.tsx
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { testApiConnectivity } from "@/services/api";
import { registerForPushNotifications } from "@/services/notifications";
import { getGuestId } from "@/utils/storage";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

function RootLayoutContent() {
  const [isReady, setIsReady] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    async function initializeApp() {
      try {
        // Test API connectivity first
        const isApiReachable = await testApiConnectivity();
        if (!isApiReachable) {
          console.warn(
            "⚠️ API may not be reachable - app will work in offline mode",
          );
        }

        // Must get/create guest session BEFORE any API calls are made
        await getGuestId();
      } catch (error) {
        console.error("Failed to initialize guest session:", error);
        // Continue anyway — subscriptions screen will show error state
      }

      try {
        await registerForPushNotifications();
      } catch (error) {
        console.log("Push notification init error:", error);
      } finally {
        setIsReady(true);
      }
    }

    initializeApp();
  }, []);

  if (!isReady) {
    return (
      <View
        style={[styles.loading, { backgroundColor: colors.background.primary }]}
      >
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
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
        <Stack.Screen name="settings" />
        <Stack.Screen name="premium" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
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
