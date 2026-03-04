// app/services/api.ts
import axios from "axios";
import { Alert } from "react-native";
import { getAuthToken, getGuestId } from "../utils/storage";

// globally display user-friendly alerts for failed requests
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const message =
        error.response.data?.message ||
        `Server returned ${error.response.status}`;
      Alert.alert("Error", message);
    } else if (error.request) {
      Alert.alert(
        "Network Error",
        "Unable to reach the server. Please check your connection.",
      );
    } else {
      Alert.alert("Error", error.message || "An unexpected error occurred.");
    }
    return Promise.reject(error);
  },
);

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
   REQUEST INTERCEPTOR
============================ */

api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();

    // Authenticated user — attach Bearer token and proceed
    if (token) {
      config.headers?.set("Authorization", `Bearer ${token}`);
      return config;
    }

    // /devices requires full auth — no guest support
    if (config.url?.startsWith("/devices")) {
      console.log("⏭ Skipping /devices request (not logged in)");
      return Promise.reject({
        response: { status: 401 },
        message: "Not authenticated",
      });
    }

    // For all other routes, attach guestId
    // getGuestId() ensures a valid server-issued ID exists before proceeding
    try {
      const guestId = await getGuestId();
      const method = config.method?.toLowerCase();
      if (method === "get" || method === "delete") {
        // GET and DELETE have no body — send guestId as query param
        config.params = { ...config.params, guestId };
      } else {
        // POST, PATCH, PUT — send guestId in request body
        config.data = { ...config.data, guestId };
      }
    } catch {
      console.error("❌ Could not get guestId for request:", config.url);
      return Promise.reject({
        response: { status: 401 },
        message: "No authentication available",
      });
    }

    return config;
  },
  (error) => Promise.reject(error),
);

export default api;

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
