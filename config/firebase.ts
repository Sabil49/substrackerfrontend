// app/config/firebase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore — getReactNativePersistence exists at runtime but is missing
// from the firebase package's published type declarations as of v10/v11.
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { Platform } from "react-native";

// IMPORTANT: these are hardcoded on purpose, not read from EXPO_PUBLIC_* env
// vars. Two real incidents came from the env-var approach:
//   1. Expo only inlines EXPO_PUBLIC_* values into release bundles when read
//      as static `process.env.EXPO_PUBLIC_X` member expressions — dynamic
//      access silently returned undefined in a release build, leaving apiKey
//      empty and crashing the app at launch (auth/invalid-api-key).
//   2. Worse: after moving to a new Expo/EAS account, that account's
//      "production" environment had EXPO_PUBLIC_FIREBASE_* variables already
//      set — to a *different, unrelated* Firebase project left over on the
//      account. Because they were non-empty, the app quietly initialized
//      against the wrong backend, breaking every sign-in method and every
//      API call, with no error to point at.
// These values are Firebase's public client config (safe to ship — they
// identify the project, they don't authorize anything on their own; access is
// enforced by Firestore/Storage rules and by requiring a signed-in user on
// every Cloud Function). Hardcoding them means an EAS project or account
// switch can never again silently repoint the app at someone else's backend.
const firebaseConfig = {
  apiKey: "AIzaSyDwL-MsUzBYWwEBdnzHjEc4E8Z4QKyMKwQ",
  authDomain: "substracker-647d9.firebaseapp.com",
  projectId: "substracker-647d9",
  storageBucket: "substracker-647d9.firebasestorage.app",
  messagingSenderId: "976201476870",
  appId: "1:976201476870:web:5f12083a18dfbd2a738c87",
};

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
export const GOOGLE_WEB_CLIENT_ID =
  "976201476870-g120h031650t2lbu74gmf92fcv65pjdc.apps.googleusercontent.com";
export const GOOGLE_IOS_CLIENT_ID =
  "976201476870-eprci5h7q38ooru4ensavkqf3j5g4fop.apps.googleusercontent.com";
export const isAppleAuthAvailable = Platform.OS === "ios";
