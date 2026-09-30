// app/services/notifications.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { formatCurrency } from "@/utils/date";
import { hasOptedOutOfNotifications } from "@/utils/storage";
import { deviceApi, Subscription, subscriptionsApi } from "./api";
import { dataCache } from "./dataCache";

// Called once from the root layout's first effect rather than at module
// import time — defers this native-module call until after the app has
// mounted, instead of running before anything else has a chance to.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    // While the app is open, reminders stay quiet (no banner, no sound) so
    // nothing pops up over what the user is doing. They still show as normal
    // notifications when the app is closed or in the background.
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: true,
    }),
  });
}

// Android 13+ only shows the permission prompt once a channel exists.
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Subscription Reminders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F5B65A",
  });
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Push notifications only work on physical devices");
    return null;
  }

  await ensureAndroidChannel();

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

// Asks for notification permission if it hasn't been decided yet.
export async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  await ensureAndroidChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

let lastReminderSignature: string | null = null;

export async function cancelAllScheduledNotifications() {
  lastReminderSignature = null;
  lastSubscriptions = null;
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

// --- Premium free trial reminder --------------------------------------------
// When the user starts Substracker's own free trial, remind them a day before
// it turns into a charge — the same promise the app makes for other trials.
const PREMIUM_TRIAL_KEY = "premiumTrial";
const PREMIUM_TRIAL_NOTICE_MS = 24 * 60 * 60 * 1000;

type PremiumTrial = { endsAt: number; price: string };

export async function rememberPremiumTrial(trial: PremiumTrial) {
  await AsyncStorage.setItem(PREMIUM_TRIAL_KEY, JSON.stringify(trial));
  await refreshReminders();
}

export async function forgetPremiumTrial() {
  await AsyncStorage.removeItem(PREMIUM_TRIAL_KEY);
}

async function getPremiumTrial(): Promise<PremiumTrial | null> {
  try {
    const trial = JSON.parse((await AsyncStorage.getItem(PREMIUM_TRIAL_KEY)) ?? "null");
    if (!trial || typeof trial.endsAt !== "number") return null;
    if (trial.endsAt <= Date.now()) {
      await forgetPremiumTrial(); // the trial is over, nothing left to remind about
      return null;
    }
    return trial;
  } catch {
    return null;
  }
}

// Runs one at a time so overlapping list refreshes can't schedule twice.
let syncQueue: Promise<unknown> = Promise.resolve();
let lastSubscriptions: Subscription[] | null = null;

// Rebuilds reminders from the latest list, e.g. after a Premium trial starts.
async function refreshReminders(): Promise<void> {
  const subscriptions =
    lastSubscriptions ??
    dataCache.get<Subscription[]>("subscriptions")?.data ??
    (await subscriptionsApi.getAll().catch(() => []));
  await syncLocalReminders(subscriptions);
}

export function syncLocalReminders(subscriptions: Subscription[]): Promise<void> {
  lastSubscriptions = subscriptions;
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

  if (!allowed) {
    await cancelAllScheduledNotifications();
    return;
  }

  const now = Date.now();
  const upcoming: { sub: Subscription; daysBefore: number; when: Date; trial: boolean }[] = [];

  // Turning reminders off in Account silences renewal reminders, but not the
  // Premium trial reminder: the user asked for that one on the paywall.
  for (const sub of optedOut ? [] : subscriptions) {
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

  const premiumTrial = await getPremiumTrial();
  const premiumTrialNotice = premiumTrial ? premiumTrial.endsAt - PREMIUM_TRIAL_NOTICE_MS : 0;
  const remindPremiumTrial = premiumTrial !== null && premiumTrialNotice > now + 60_000;

  upcoming.sort((a, b) => a.when.getTime() - b.when.getTime());
  const planned = upcoming.slice(0, MAX_SCHEDULED - (remindPremiumTrial ? 1 : 0));

  // Same reminders as last time? Then there is nothing to do.
  const signature = planned
    .map((item) => `${item.sub.id}|${item.sub.name}|${item.sub.amount}|${item.daysBefore}|${item.when.getTime()}|${item.trial}`)
    .concat(remindPremiumTrial ? [`premium|${premiumTrial!.endsAt}|${premiumTrial!.price}`] : [])
    .join(";");
  if (signature === lastReminderSignature) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (remindPremiumTrial) {
    const store = Platform.OS === "ios" ? "App Store" : "Google Play";
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your Premium free trial ends tomorrow",
        body: `You'll be charged ${premiumTrial!.price} unless you cancel in your ${store} subscriptions.`,
        sound: true,
        data: { premiumTrial: true },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(premiumTrialNotice) },
    });
  }

  for (const { sub, daysBefore, when, trial } of planned) {
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

  lastReminderSignature = signature;
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
