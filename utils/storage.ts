// app/utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

// Auth session state (the SecureStore-backed JWT this app used to manage
// itself) now lives in Firebase Auth's own persisted session — see
// contexts/AuthContext.tsx and config/firebase.ts.
export const STORAGE_KEYS = {
  DEVICE_TOKEN: "deviceToken",
  ONBOARDING_COMPLETED: "onboardingCompleted",
  NOTIFICATION_PERMISSION_ASKED: "notificationPermissionAsked",
};

// The user switched notifications off in Account. Launch-time auto-registration
// must respect this, otherwise the toggle flips back on the next time the app opens.
const NOTIFICATIONS_OPT_OUT_KEY = "notificationsOptOut";

export async function setNotificationsOptOut(optedOut: boolean) {
  if (optedOut) {
    await AsyncStorage.setItem(NOTIFICATIONS_OPT_OUT_KEY, "true");
  } else {
    await AsyncStorage.removeItem(NOTIFICATIONS_OPT_OUT_KEY);
  }
}

export async function hasOptedOutOfNotifications(): Promise<boolean> {
  return (await AsyncStorage.getItem(NOTIFICATIONS_OPT_OUT_KEY)) === "true";
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
