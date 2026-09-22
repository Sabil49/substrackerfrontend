// app/utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpsCallable } from "firebase/functions";
import { functionsInstance } from "../config/firebase";

// Auth session state (the SecureStore-backed JWT this app used to manage
// itself) now lives in Firebase Auth's own persisted session — see
// contexts/AuthContext.tsx and config/firebase.ts. This file only tracks the
// anonymous guest-mode session, which is separate from Firebase Auth.
export const STORAGE_KEYS = {
  GUEST_ID: "guestId",
  DEVICE_TOKEN: "deviceToken",
  ONBOARDING_COMPLETED: "onboardingCompleted",
  NOTIFICATION_PERMISSION_ASKED: "notificationPermissionAsked",
};

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

        console.log("🌐 Requesting new guest session from Cloud Functions");

        // Request a server-side guest session
        const createGuestSession = httpsCallable(functionsInstance, "createGuestSession");
        const response = await createGuestSession();
        const data = response.data as { guestId: string };
        console.log("📦 Guest session response data:", data);

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
        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.error("🌐 Network error - check internet connection");
        }

        throw error;
      }
    })();
  }
  return guestIdPromise;
}

export async function clearGuestSession() {
  guestIdPromise = null;
  await AsyncStorage.removeItem(STORAGE_KEYS.GUEST_ID);
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
