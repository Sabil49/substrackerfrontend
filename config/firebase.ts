// app/config/firebase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore — getReactNativePersistence exists at runtime but is missing
// from the firebase package's published type declarations as of v10/v11.
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { Platform } from "react-native";

// IMPORTANT: Expo only inlines EXPO_PUBLIC_* values into release bundles when
// they are written as static `process.env.EXPO_PUBLIC_X` member expressions.
// Dynamic access (`process.env[key]`) works in dev but returns undefined in a
// production build, which left apiKey empty and made Firebase Auth throw
// `auth/invalid-api-key` at import time — an uncaught JS fatal that aborted
// the app at launch. The fallbacks are public client identifiers (they ship
// in every app binary), so they are safe to keep in source.
const clean = (value: string | undefined, fallback: string) =>
  value?.trim() || fallback;

const firebaseConfig = {
  apiKey: clean(
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    "AIzaSyDwL-MsUzBYWwEBdnzHjEc4E8Z4QKyMKwQ",
  ),
  authDomain: clean(
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    "substracker-647d9.firebaseapp.com",
  ),
  projectId: clean(
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    "substracker-647d9",
  ),
  storageBucket: clean(
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    "substracker-647d9.firebasestorage.app",
  ),
  messagingSenderId: clean(
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    "976201476870",
  ),
  appId: clean(
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    "1:976201476870:web:5f12083a18dfbd2a738c87",
  ),
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
export const GOOGLE_WEB_CLIENT_ID = clean(
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  "976201476870-g120h031650t2lbu74gmf92fcv65pjdc.apps.googleusercontent.com",
);
export const GOOGLE_IOS_CLIENT_ID = clean(
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  "976201476870-eprci5h7q38ooru4ensavkqf3j5g4fop.apps.googleusercontent.com",
);
export const isAppleAuthAvailable = Platform.OS === "ios";
