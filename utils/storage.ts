// app/utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const STORAGE_KEYS = {
  GUEST_ID: "guestId",
  AUTH_TOKEN: "authToken",
  DEVICE_TOKEN: "deviceToken",
  ONBOARDING_COMPLETED: "onboardingCompleted",
  NOTIFICATION_PERMISSION_ASKED: "notificationPermissionAsked",
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// A valid server-issued guestId looks like: guest_<32 hex chars>
// Old client-generated ones look like: guest_<uuid-v4 with dashes>
function isServerIssuedGuestId(id: string): boolean {
  return /^guest_[0-9a-f]{32}$/.test(id);
}

let guestIdPromise: Promise<string> | null = null;

export function getGuestId(): Promise<string> {
  if (!guestIdPromise) {
    guestIdPromise = (async () => {
      try {
        const existing = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_ID);

        // Only reuse if it was issued by the server (hex format)
        // Discard old client-generated UUIDs — they don't exist in the DB
        if (existing && isServerIssuedGuestId(existing)) {
          console.log("✅ Using existing server-issued guestId");
          return existing;
        }

        // Clear any stale/invalid guestId before requesting a new one
        if (existing) {
          await AsyncStorage.removeItem(STORAGE_KEYS.GUEST_ID);
          console.log(
            "🗑️ Cleared stale guestId, requesting new one from server",
          );
        }

        console.log("🌐 Requesting new guest session from:", `${API_URL}/api/guest`);

        // Request a server-side guest session
        const response = await fetch(`${API_URL}/api/guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        console.log("📡 Guest API response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Guest API error:", response.status, errorText);
          throw new Error(`Server returned ${response.status} for /api/guest: ${errorText}`);
        }

        const data = await response.json();
        console.log("📦 Guest API response data:", data);

        const guestId: string = data.guestId;

        if (!guestId || !isServerIssuedGuestId(guestId)) {
          console.error("❌ Invalid guestId format received:", guestId);
          throw new Error(`Server returned invalid guestId format: ${guestId}`);
        }

        await AsyncStorage.setItem(STORAGE_KEYS.GUEST_ID, guestId);
        console.log("✅ New server-issued guestId stored:", guestId);
        return guestId;
      } catch (error) {
        guestIdPromise = null; // Allow retry on next call
        console.error("❌ getGuestId failed:", error);

        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error("🌐 Network error - check internet connection");
        }

        throw error;
      }
    })();
  }
  return guestIdPromise;
}

export async function setAuthToken(token: string) {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
  } catch (error) {
    console.error("[setAuthToken] Failed to store auth token securely:", error);
    throw new Error("Failed to securely store authentication token");
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error(
      "[getAuthToken] Failed to retrieve auth token from secure store:",
      error,
    );
    return null;
  }
}

export async function clearAuthToken() {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error(
      "[clearAuthToken] Failed to delete auth token from secure store:",
      error,
    );
    throw new Error("Failed to clear authentication token");
  }
}

export async function setOnboardingCompleted() {
  await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, "true");
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const completed = await AsyncStorage.getItem(
    STORAGE_KEYS.ONBOARDING_COMPLETED,
  );
  return completed === "true";
}

export async function setNotificationPermissionAsked() {
  await AsyncStorage.setItem(
    STORAGE_KEYS.NOTIFICATION_PERMISSION_ASKED,
    "true",
  );
}

export async function wasNotificationPermissionAsked(): Promise<boolean> {
  const asked = await AsyncStorage.getItem(
    STORAGE_KEYS.NOTIFICATION_PERMISSION_ASKED,
  );
  return asked === "true";
}
