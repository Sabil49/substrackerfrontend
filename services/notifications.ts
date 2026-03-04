// app/services/notifications.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { deviceApi } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

export async function scheduleLocalNotification(
  subscriptionName: string,
  amount: number,
  currency: string,
  daysUntil: number,
  scheduledDate: Date,
) {
  let title: string;
  let body: string;

  if (daysUntil === 0) {
    title = `${subscriptionName} charges today!`;
    body = `${currency} ${amount} will be charged today`;
  } else if (daysUntil === 1) {
    title = `${subscriptionName} charges tomorrow`;
    body = `${currency} ${amount} will be charged in 1 day`;
  } else {
    title = `${subscriptionName} upcoming charge`;
    body = `${currency} ${amount} will be charged in ${daysUntil} days`;
  }

  const secondsUntilNotification = Math.floor(
    (scheduledDate.getTime() - Date.now()) / 1000,
  );

  if (secondsUntilNotification <= 0) {
    console.warn(
      `[scheduleLocalNotification] Skipping notification for "${subscriptionName}" - scheduled date is in the past (${secondsUntilNotification}s ago)`,
      {
        scheduledDate: scheduledDate.toISOString(),
        now: new Date().toISOString(),
      },
    );
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { subscriptionName, daysUntil },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilNotification,
    },
  });
}

export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function sendPushTokenToServer(token: string) {
  try {
    await deviceApi.register(token, Platform.OS as "ios" | "android");
    await AsyncStorage.setItem("deviceToken", token);
    console.log("Push token sent to server successfully");
  } catch (error) {
    console.error("Failed to send push token to server:", error);
    throw error;
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
