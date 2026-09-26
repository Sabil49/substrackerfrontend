// app/services/notifications.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { formatCurrency } from "@/utils/date";
import { hasOptedOutOfNotifications } from "@/utils/storage";
import { deviceApi, Subscription } from "./api";

// Called once from the root layout's first effect rather than at module
// import time — defers this native-module call until after the app has
// mounted, instead of running before anything else has a chance to.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Push notifications only work on physical devices");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Subscription Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F5B65A",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Failed to get push token");
    return null;
  }

  try {
    // Use expoConfig (SDK 49+) with fallback for older SDKs
    const projectId =
      Constants.expoConfig?.extra?.expoProjectId ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      (Constants.manifest as any)?.extra?.expoProjectId;

    if (!projectId) {
      throw new Error("expoProjectId is not configured in app.json extra");
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    if (__DEV__) {
      console.log("Push notification token:", token);
    }

    await deviceApi.register(token, Platform.OS as "ios" | "android");
    // Only persist token after successful backend registration
    await AsyncStorage.setItem("deviceToken", token);

    return token;
  } catch (error) {
    console.error("Error registering for push notifications:", error);
    return null;
  }
}

export async function checkNotificationPermissions() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// --- Renewal reminders ------------------------------------------------------
// Reminders are scheduled on the device itself, so they fire on time even
// offline and are never delivered twice. The whole set is rebuilt from the
// user's current subscriptions whenever the list loads, which keeps it correct
// after adding, editing, deleting, cancelling, or a renewal date rolling over.

const REMINDER_HOUR = 9; // local time
const MAX_SCHEDULED = 60; // iOS keeps at most 64 pending local notifications
const DEFAULT_REMINDER_DAYS = [7, 3, 1, 0];

// Dates are stored as timestamps at a fixed hour UTC, so the UTC calendar day
// is the day the user picked.
function calendarDay(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
}

function whenText(daysBefore: number) {
  if (daysBefore <= 0) return "today";
  if (daysBefore === 1) return "tomorrow";
  return `in ${daysBefore} days`;
}

function money(amount: number, currency: string) {
  try {
    return formatCurrency(amount, currency || "USD");
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

// Runs one at a time so overlapping list refreshes can't schedule twice.
let syncQueue: Promise<unknown> = Promise.resolve();

export function syncLocalReminders(subscriptions: Subscription[]): Promise<void> {
  const run = syncQueue.then(() => rebuildReminders(subscriptions));
  syncQueue = run.catch(() => undefined);
  return run.catch((error) => {
    console.log("Could not update reminders:", error);
  });
}

async function rebuildReminders(subscriptions: Subscription[]) {
  if (Platform.OS === "web") return;

  const [allowed, optedOut] = await Promise.all([
    checkNotificationPermissions(),
    hasOptedOutOfNotifications(),
  ]);

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!allowed || optedOut) return;

  const now = Date.now();
  const upcoming: { sub: Subscription; daysBefore: number; when: Date; trial: boolean }[] = [];

  for (const sub of subscriptions) {
    if (!sub.isActive || sub.isCanceled) continue;

    const trial = Boolean(sub.isTrial && sub.trialEndDate);
    const day = calendarDay(trial ? sub.trialEndDate : sub.nextBillingDate);
    if (!day) continue;

    const days = sub.notifyDaysBefore?.length ? sub.notifyDaysBefore : DEFAULT_REMINDER_DAYS;
    for (const daysBefore of days) {
      const when = new Date(day.y, day.m, day.d - daysBefore, REMINDER_HOUR, 0, 0);
      // Never schedule something that would fire right away.
      if (when.getTime() <= now + 60_000) continue;
      upcoming.push({ sub, daysBefore, when, trial });
    }
  }

  upcoming.sort((a, b) => a.when.getTime() - b.when.getTime());

  for (const { sub, daysBefore, when, trial } of upcoming.slice(0, MAX_SCHEDULED)) {
    const amount = money(Number(sub.amount), sub.currency);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: trial
          ? `${sub.name} free trial ends ${whenText(daysBefore)}`
          : `${sub.name} renews ${whenText(daysBefore)}`,
        body: trial
          ? `Cancel before it ends to avoid being charged ${amount}.`
          : `${amount} will be charged ${whenText(daysBefore)}.`,
        sound: true,
        data: { subscriptionId: sub.id, daysBefore },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
  }
}

export async function removePushTokenFromServer(token: string) {
  try {
    await deviceApi.unregister(token);
    await AsyncStorage.removeItem("deviceToken");
    console.log("Push token removed from server successfully");
  } catch (error) {
    console.error("Failed to remove push token from server:", error);
    throw error;
  }
}
