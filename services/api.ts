// app/services/api.ts
import axios from "axios";
import Constants from "expo-constants";
import { Alert, Platform } from "react-native";
import { getAuthToken, getGuestId } from "../utils/storage";

const staticDefaultApiUrl = "https://substrackerapi.vercel.app";
const emulatorFallbackUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://127.0.0.1:3000";

const expoExtra =
  (Constants.expoConfig as any)?.extra ||
  (Constants.manifest as any)?.extra ||
  {};
const envUrl =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (expoExtra?.EXPO_PUBLIC_API_URL as string)?.trim() ||
  (expoExtra?.API_URL as string)?.trim();

const shouldUseEmulatorUrl = __DEV__ && !Constants.isDevice;
export const API_URL =
  envUrl || (shouldUseEmulatorUrl ? emulatorFallbackUrl : staticDefaultApiUrl);

if (!envUrl) {
  console.warn(
    `⚠️ EXPO_PUBLIC_API_URL is not set; using ${
      shouldUseEmulatorUrl ? "emulator/sim URL" : "production default"
    }`,
  );
}
console.log("🌐 API URL configured as:", API_URL);

// Validate health quickly
export const testApiConnectivity = async (): Promise<boolean> => {
  try {
    const resp = await fetch(`${API_URL}/api/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (resp.ok) {
      console.log("✅ API health OK");
      return true;
    }
    console.warn("⚠️ API health returned non-2xx:", resp.status);
    return false;
  } catch (err) {
    console.error("❌ API health check failed:", err);
    return false;
  }
};

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isNetworkError = !error.response && error.request;
    const requestConfig = error.config || {};

    // Retry once on fallback for situations where emulator localhost is unreachable
    if (
      isNetworkError &&
      !requestConfig.__retry &&
      requestConfig.baseURL !== `${staticDefaultApiUrl}/api`
    ) {
      requestConfig.__retry = true;
      const fallbackBaseURL = `${staticDefaultApiUrl}/api`;
      console.warn(
        `⚠️ Network error‚ retrying on production API: ${requestConfig.baseURL} -> ${fallbackBaseURL}`,
      );
      try {
        return await api.request({
          ...requestConfig,
          baseURL: fallbackBaseURL,
        });
      } catch (retryError) {
        // continue to alert below
        error = retryError;
      }
    }

    if (error.response) {
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        `Server returned ${error.response.status}`;
      Alert.alert("Error", message);
    } else if (isNetworkError) {
      Alert.alert(
        "Network Error",
        `Unable to reach the server at ${requestConfig.baseURL || API_URL}. Please check your connection or verify API host.`,
      );
    } else {
      Alert.alert("Error", error.message || "An unexpected error occurred.");
    }
    return Promise.reject(error);
  },
);

api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }

    // Guest support (fallback)
    if (!token) {
      try {
        const guestId = await getGuestId();
        const method = config.method?.toLowerCase();
        if (method === "get" || method === "delete") {
          config.params = { ...config.params, guestId };
        } else {
          config.data = { ...config.data, guestId };
        }
      } catch (error) {
        console.warn("⚠️ Could not get guestId, proceeding without it", error);
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

export default api;

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
}

/* ============================
   SUBSCRIPTIONS API
============================ */

export const subscriptionsApi = {
  getAll: async (): Promise<Subscription[]> => {
    const response = await api.get("/subscriptions");
    return response.data.subscriptions;
  },

  getOne: async (id: string): Promise<Subscription> => {
    const response = await api.get(`/subscriptions/${id}`);
    return response.data.subscription;
  },

  create: async (data: CreateSubscriptionPayload): Promise<Subscription> => {
    const payload = {
      ...data,
      billingCycle: data.billingCycle.toUpperCase(),
    };
    const response = await api.post("/subscriptions", payload);
    return response.data.subscription;
  },

  update: async (
    id: string,
    data: UpdateSubscriptionPayload,
  ): Promise<Subscription> => {
    const payload = {
      ...data,
      ...(data.billingCycle
        ? { billingCycle: data.billingCycle.toUpperCase() }
        : {}),
    };
    const response = await api.patch(`/subscriptions/${id}`, payload);
    return response.data.subscription;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/subscriptions/${id}`);
  },

  markReviewed: async (id: string): Promise<Subscription> => {
    const response = await api.patch(`/subscriptions/${id}`, {
      lastReviewedAt: new Date().toISOString(),
    });
    return response.data.subscription;
  },

  logUsage: async (id: string): Promise<Subscription> => {
    const response = await api.patch(`/subscriptions/${id}`, {
      usageCount: "increment",
    });
    return response.data.subscription;
  },

  cancel: async (id: string, cancelReason?: string): Promise<Subscription> => {
    const response = await api.patch(`/subscriptions/${id}`, {
      isCanceled: true,
      isActive: false,
      ...(cancelReason ? { cancelReason } : {}),
    });
    return response.data.subscription;
  },
};

/* ============================
   ANALYTICS API
============================ */

export const analyticsApi = {
  get: async (): Promise<Analytics> => {
    const response = await api.get("/analytics");
    return response.data;
  },
};

/* ============================
   USER API
============================ */

export const userApi = {
  get: async (): Promise<User> => {
    const response = await api.get("/user");
    return response.data.user;
  },
};

/* ============================
   AUTH API
============================ */

export const authApi = {
  signup: async (
    email: string,
    password: string,
  ): Promise<{ token: string; user: User }> => {
    const response = await api.post("/auth/signup", { email, password });
    return response.data;
  },

  login: async (
    email: string,
    password: string,
  ): Promise<{ token: string; user: User }> => {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore network errors; simply clear token locally
    }
  },
};

/* ============================
   TEMPLATES API
============================ */

export const templatesApi = {
  getAll: async (): Promise<Template[]> => {
    const response = await api.get("/templates");
    return response.data.templates;
  },
};

/* ============================
   DEVICE API
============================ */

export const deviceApi = {
  register: async (
    deviceToken: string,
    platform: "ios" | "android",
  ): Promise<void> => {
    const token = await getAuthToken();
    if (!token) {
      console.log("⏭ Skipping device registration (not logged in)");
      return;
    }
    await api.post("/devices", { deviceToken, platform });
  },

  unregister: async (deviceToken: string): Promise<void> => {
    const token = await getAuthToken();
    if (!token) {
      console.log("⏭ Skipping device unregistration (not logged in)");
      return;
    }
    await api.delete(`/devices?deviceToken=${encodeURIComponent(deviceToken)}`);
  },
};
