// app/services/api.ts
import { format } from "date-fns";
import { httpsCallable } from "firebase/functions";
import { functionsInstance } from "../config/firebase";

// Kept only so other files that still import API_URL for display/logging
// don't break — Cloud Functions calls no longer go through a base URL like
// the old Next.js backend did.
export const API_URL = "(firebase cloud functions)";

export const testApiConnectivity = async (): Promise<boolean> => {
  try {
    await callFn("healthCheck", {});
    console.log("✅ Cloud Functions reachable");
    return true;
  } catch (err) {
    console.error("❌ Cloud Functions health check failed:", err);
    return false;
  }
};

// Every callable already gets the signed-in user's Firebase ID token
// attached automatically by the Functions client SDK — unlike the old axios
// setup, there's no manual token-fetch/interceptor step. Every caller is
// authenticated (the app requires sign-in before it renders any screen that
// calls these), so no guest fallback is needed here.
async function callFn<TResult = any>(name: string, data: Record<string, any> = {}): Promise<TResult> {
  const callable = httpsCallable(functionsInstance, name);
  const response = await callable(data);
  return response.data as TResult;
}

const OFFLINE_MESSAGE =
  "We couldn't connect. Check your internet connection and try again.";

// Plain-language text for the error codes users can realistically hit.
const CODE_MESSAGES: Record<string, string> = {
  // Firebase Auth
  "auth/invalid-credential": "Incorrect email or password. Please try again.",
  "auth/wrong-password": "Incorrect email or password. Please try again.",
  "auth/invalid-login-credentials": "Incorrect email or password. Please try again.",
  "auth/user-not-found": "We couldn't find an account with that email.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/missing-email": "Please enter your email address.",
  "auth/missing-password": "Please enter your password.",
  "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
  "auth/weak-password": "Please choose a stronger password (at least 8 characters).",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": OFFLINE_MESSAGE,
  "auth/user-disabled": "This account has been disabled. Please contact support.",
  "auth/account-exists-with-different-credential":
    "An account already exists with this email using a different sign-in method.",
  "auth/requires-recent-login": "For your security, please sign in again and retry.",
  "auth/operation-not-allowed": "This sign-in method isn't available right now.",
  // Cloud Functions
  "functions/unauthenticated": "Your session has expired. Please sign in again.",
  "functions/permission-denied": "You don't have permission to do that.",
  "functions/not-found": "We couldn't find that. It may have been removed.",
  "functions/unavailable": OFFLINE_MESSAGE,
  "functions/deadline-exceeded": OFFLINE_MESSAGE,
  "functions/invalid-argument": "Some details look incorrect. Please check them and try again.",
  "functions/internal": "Something went wrong on our side. Please try again in a moment.",
  "functions/unknown": "Something went wrong. Please try again in a moment.",
  "functions/cancelled": "The request was cancelled. Please try again.",
  "functions/failed-precondition": "We couldn't complete that request. Please try again.",
  "functions/already-exists": "That already exists.",
  "functions/resource-exhausted":
    "You've reached the free plan limit. Upgrade to Premium to add more.",
  // In-app purchases
  "network-error": OFFLINE_MESSAGE,
  "service-error": "The App Store isn't available right now. Please try again shortly.",
  "item-unavailable": "This plan isn't available right now. Please try again later.",
  "product-not-found": "This plan isn't available right now. Please try again later.",
  "billing-unavailable": "Purchases aren't available on this device right now.",
  "not-prepared": "The App Store isn't ready yet. Please try again in a moment.",
  "E_NOT_PREPARED": "The App Store isn't ready yet. Please try again in a moment.",
};

// Server messages we trust to show as-is for these codes (they're written for
// users, e.g. the free-plan limit or "already linked to another account").
const SERVER_MESSAGE_CODES = new Set([
  "functions/resource-exhausted",
  "functions/already-exists",
  "functions/failed-precondition",
  "functions/invalid-argument",
]);

const CANCEL_CODES = new Set([
  "ERR_REQUEST_CANCELED",
  "ERR_CANCELED",
  "user-cancelled",
  "E_USER_CANCELLED",
  "SIGN_IN_CANCELLED",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "-5",
  "12501",
]);

// True when the user backed out of a sign-in or purchase sheet — that isn't
// an error and shouldn't show an alert.
export function isUserCancelledError(error: any): boolean {
  const code = String(error?.code ?? "");
  if (CANCEL_CODES.has(code)) return true;
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("user cancel") || message.includes("user canceled") || message.includes("cancelled by user");
}

// Looks like something a developer wrote, not something to show a person.
const TECHNICAL_PATTERN =
  /\b(null|undefined|NaN|TypeError|ReferenceError|SyntaxError|Firebase|firestore|zod|stack|json|expected|received|internal|invalid[_ ]argument|callable|native|module|exception|http|status|code)\b|\[[^\]]*\]|[{}<>]|\bat \S+ \(/i;

const IDENTIFIER_PATTERN = /_|\b[a-z][a-z0-9-]*(\.[a-z0-9-]+){2,}\b|[a-z]{2,}[A-Z][a-z]+|\w+\(\)/;

function isUserFriendly(message: unknown): message is string {
  if (typeof message !== "string") return false;
  const text = message.trim();
  // A real sentence: raw one-word errors ("Required", "Unauthorized") are not.
  return (
    text.includes(" ") &&
    text.length <= 180 &&
    !TECHNICAL_PATTERN.test(text) &&
    !IDENTIFIER_PATTERN.test(text)
  );
}

export function getFriendlyErrorMessage(
  error: any,
  fallback = "Something went wrong. Please try again.",
) {
  const code = typeof error?.code === "string" ? error.code : "";
  const rawMessage = typeof error?.message === "string" ? error.message : "";

  if (SERVER_MESSAGE_CODES.has(code) && isUserFriendly(rawMessage)) return rawMessage;
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  if (/network request failed|network error|failed to fetch|timed? ?out|offline/i.test(rawMessage)) {
    return OFFLINE_MESSAGE;
  }

  if (isUserFriendly(rawMessage)) return rawMessage;
  return fallback;
}

/* ============================
   TYPES
============================ */

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  customCycleDays?: number;
  startDate: string;
  nextBillingDate: string;
  category?: string;
  notes?: string;
  isActive: boolean;
  isTrial?: boolean;
  trialEndDate?: string | null;
  iconUrl?: string;
  color?: string;
  notifyDaysBefore?: number[];
  isSilent?: boolean;
  isCanceled?: boolean;
  cancelReason?: string;
  lastReviewedAt?: string | null;
  usageCount?: number;
  valueScore?: "worth-it" | "overpriced" | "unused";
  receiptImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Analytics {
  monthlyTotal: number;
  yearlyTotal: number;
  totalSubscriptions: number;
  categoryBreakdown: Record<string, number>;
  upcomingCharges: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    nextBillingDate: string;
    daysUntil: number;
  }[];
  mostExpensive: {
    id: string;
    name: string;
    amount: number;
    currency: string;
  } | null;
}

export interface User {
  id: string;
  email?: string;
  isPro: boolean;
  proExpiresAt?: string | null;
  subscriptionCount: number;
  subscriptionLimit: number | null;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  iconUrl?: string;
  color?: string;
  avgPrice?: number;
}


export interface ImportedSubscription {
  name: string;
  amount: number | null;
  currency: string;
  billingCycle: string;
  startDate: string | null;
  trialEndDate: string | null;
  isTrial: boolean;
  category: string;
  notes: string;
  confidence: number;
  receiptImageUrl?: string | null;
}
export interface CreateSubscriptionPayload {
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  customCycleDays?: number;
  category?: string;
  startDate: string;
  isTrial?: boolean;
  trialEndDate?: string;
  notifyDaysBefore?: number[];
  notes?: string;
  isActive?: boolean;
  receiptImageUrl?: string;
}

export interface UpdateSubscriptionPayload {
  name?: string;
  amount?: number;
  currency?: string;
  billingCycle?: string;
  customCycleDays?: number;
  startDate?: string;
  category?: string;
  notes?: string;
  isTrial?: boolean;
  trialEndDate?: string | null;
  notifyDaysBefore?: number[];
  isActive?: boolean;
  isCanceled?: boolean;
  cancelReason?: string;
  lastReviewedAt?: string;
  usageCount?: number | "increment";
  receiptImageUrl?: string;
}

/* ============================
   SUBSCRIPTIONS API
============================ */

export const subscriptionsApi = {
  getAll: async (): Promise<Subscription[]> => {
    const response = await callFn<{ subscriptions: Subscription[] }>("getSubscriptions");
    return response.subscriptions;
  },

  getOne: async (id: string): Promise<Subscription> => {
    const response = await callFn<{ subscription: Subscription }>("getSubscription", { id });
    return response.subscription;
  },

  create: async (data: CreateSubscriptionPayload): Promise<Subscription> => {
    // `today` is the user's own calendar date, so "started today" means today
    // on their phone, whatever the server's timezone.
    const payload = {
      ...data,
      billingCycle: data.billingCycle.toUpperCase(),
      today: format(new Date(), "yyyy-MM-dd"),
    };
    const response = await callFn<{ subscription: Subscription }>("createSubscription", payload);
    return response.subscription;
  },

  update: async (id: string, data: UpdateSubscriptionPayload): Promise<Subscription> => {
    const payload = {
      ...data,
      id,
      today: format(new Date(), "yyyy-MM-dd"),
      ...(data.billingCycle ? { billingCycle: data.billingCycle.toUpperCase() } : {}),
    };
    const response = await callFn<{ subscription: Subscription }>("updateSubscription", payload);
    return response.subscription;
  },

  delete: async (id: string): Promise<void> => {
    await callFn("deleteSubscription", { id });
  },

  markReviewed: async (id: string): Promise<Subscription> => {
    const response = await callFn<{ subscription: Subscription }>("updateSubscription", {
      id,
      lastReviewedAt: new Date().toISOString(),
    });
    return response.subscription;
  },

  logUsage: async (id: string): Promise<Subscription> => {
    const response = await callFn<{ subscription: Subscription }>("updateSubscription", {
      id,
      usageCount: "increment",
    });
    return response.subscription;
  },

  cancel: async (id: string, cancelReason?: string): Promise<Subscription> => {
    const response = await callFn<{ subscription: Subscription }>("updateSubscription", {
      id,
      isCanceled: true,
      isActive: false,
      ...(cancelReason ? { cancelReason } : {}),
    });
    return response.subscription;
  },
};


/* ============================
   IMPORT API
============================ */

export const importApi = {
  receipt: async (data: { imageBase64: string; mimeType?: string }): Promise<ImportedSubscription> => {
    const response = await callFn<{ subscription: ImportedSubscription }>("importReceipt", data);
    return response.subscription;
  },
};
/* ============================
   ANALYTICS API
============================ */

export const analyticsApi = {
  get: async (): Promise<Analytics> => {
    return callFn<Analytics>("getAnalytics");
  },
};

/* ============================
   USER API
============================ */

export const userApi = {
  get: async (): Promise<User> => {
    const response = await callFn<{ user: User }>("getUser");
    return response.user;
  },

  deleteAccount: async (): Promise<void> => {
    await callFn("deleteUser");
  },
};

/* ============================
   AUTH API
============================ */

export const authApi = {
  // Call once right after Firebase Auth sign-in succeeds (any provider).
  // The ID token is attached automatically by the Functions client SDK.
  syncSession: async (): Promise<User> => {
    const response = await callFn<{ user: User }>("syncSession");
    return response.user;
  },
};

/* ============================
   TEMPLATES API
============================ */

export const templatesApi = {
  getAll: async (): Promise<Template[]> => {
    const response = await callFn<{ templates: Template[] }>("getTemplates");
    return response.templates;
  },
};

/* ============================
   DEVICE API
============================ */

export const deviceApi = {
  register: async (deviceToken: string, platform: "ios" | "android"): Promise<void> => {
    await callFn("registerDevice", { deviceToken, platform });
  },

  unregister: async (deviceToken: string): Promise<void> => {
    await callFn("unregisterDevice", { deviceToken });
  },
};
