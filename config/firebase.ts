// app/config/firebase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore — getReactNativePersistence exists at runtime but is missing
// from the firebase package's published type declarations as of v10/v11.
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { Platform } from "react-native";

const expoExtra =
  (Constants.expoConfig as any)?.extra ||
  (Constants.manifest as any)?.extra ||
  {};

function readEnv(key: string): string {
  return (
    (process.env as any)[key]?.trim() ||
    (expoExtra?.[key] as string)?.trim() ||
    ""
  );
}

const firebaseConfig = {
  apiKey: readEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("EXPO_PUBLIC_FIREBASE_APP_ID"),
};

if (!firebaseConfig.apiKey) {
  console.warn(
    "⚠️ Firebase web config is not set (EXPO_PUBLIC_FIREBASE_* env vars). " +
      "Email/Google/Apple sign-in will not work until these are filled in.",
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// `initializeAuth` (with AsyncStorage persistence) can only be called once —
// on Fast Refresh in dev it would throw "already initialized", so fall back
// to `getAuth` if that happens.
let authInstance: ReturnType<typeof getAuth>;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const functionsInstance = getFunctions(app);
export const GOOGLE_WEB_CLIENT_ID = readEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");
export const GOOGLE_IOS_CLIENT_ID = readEnv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID");
export const isAppleAuthAvailable = Platform.OS === "ios";
