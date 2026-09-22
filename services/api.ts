// app/services/api.ts
import { httpsCallable } from "firebase/functions";
import { functionsInstance, auth } from "../config/firebase";
import { getGuestId } from "../utils/storage";

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
// setup, there's no manual token-fetch/interceptor step. `guestId` is sent
// alongside on every call; the backend only uses it when there's no
// authenticated caller, so it's harmless to include even when signed in.
async function callFn<TResult = any>(name: string, data: Record<string, any> = {}): Promise<TResult> {
  let guestId: string | undefined;
  if (!auth.currentUser) {
    try {
      guestId = await getGuestId();
    } catch (error) {
      console.warn("⚠️ Could not get guestId, proceeding without it", error);
    }
  }

  try {
    const callable = httpsCallable(functionsInstance, name);
    const response = await callable({ ...data, ...(guestId ? { guestId } : {}) });
    return response.data as TResult;
  } catch (error) {
    throw error;
  }
}

export function getFriendlyErrorMessage(
  error: any,
  fallback = "Something went wrong. Please try again.",
) {
  // Firebase callable errors: { code: "functions/<name>", message, details }
  if (typeof error?.code === "string" && error.code.startsWith("functions/")) {
    if (error.code === "functions/unavailable" || error.code === "functions/deadline-exceeded") {
      return "We could not connect to SubTracker. Check your internet connection and try again.";
    }
    if (typeof error.message === "string" && error.message.trim()) return error.message;
  }

  if (typeof error?.message === "string" && error.message.trim()) return error.message;
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
    const payload = { ...data, billingCycle: data.billingCycle.toUpperCase() };
    const response = await callFn<{ subscription: Subscription }>("createSubscription", payload);
    return response.subscription;
  },

  update: async (id: string, data: UpdateSubscriptionPayload): Promise<Subscription> => {
    const payload = {
      ...data,
      id,
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
  syncSession: async (guestId?: string): Promise<User> => {
    const response = await callFn<{ user: User }>("syncSession", { guestId });
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
    // Allow registration for both authenticated and guest users — callFn
    // attaches guestId automatically when nobody is signed in.
    await callFn("registerDevice", { deviceToken, platform });
  },

  unregister: async (deviceToken: string): Promise<void> => {
    await callFn("unregisterDevice", { deviceToken });
  },
};
