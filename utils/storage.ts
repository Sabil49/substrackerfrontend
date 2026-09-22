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
