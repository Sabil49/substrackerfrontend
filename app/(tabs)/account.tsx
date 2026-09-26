// app/(tabs)/account.tsx
// Merged Profile + Settings into one Account screen, matching Account.png.
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage, subscriptionsApi, User, userApi } from "@/services/api";
import {
  cancelAllScheduledNotifications,
  checkNotificationPermissions,
  registerForPushNotifications,
  removePushTokenFromServer,
  requestNotificationPermission,
  syncLocalReminders,
} from "@/services/notifications";
import { restorePremiumFromStore } from "@/services/premium";
import { hasOptedOutOfNotifications, setNotificationsOptOut } from "@/utils/storage";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { firebaseUser, signOut: firebaseSignOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // "On" means the device allows notifications AND the user hasn't switched
  // reminders off in the app. Reminders are scheduled on the device itself, so
  // this doesn't depend on any push-notification registration succeeding.
  const refreshNotificationState = async () => {
    const [granted, optedOut] = await Promise.all([
      checkNotificationPermissions(),
      hasOptedOutOfNotifications(),
    ]);
    setNotificationsEnabled(granted && !optedOut);
  };

  const loadUser = async () => {
    try {
      const data = await userApi.get();
      setUser(data);
    } catch {
      console.log("Could not load user profile");
      setUser(null);
    }
    try {
      await refreshNotificationState();
    } catch {
      // leave the switch as it is
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUser();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firebaseUser]),
  );

  const handleNotificationToggle = async (value: boolean) => {
    if (notificationsBusy) return;
    setNotificationsBusy(true);
    // Flip immediately so the switch feels instant; undone below on failure.
    setNotificationsEnabled(value);

    try {
      if (value) {
        await setNotificationsOptOut(false);
        const allowed = await requestNotificationPermission();
        if (!allowed) {
          setNotificationsEnabled(false);
          Alert.alert(
            "Notifications Are Off",
            "Allow notifications for Substracker in your device settings to get renewal reminders.",
            [
              { text: "Not Now", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          // Reminders are scheduled on this device; registering for push is a
          // bonus that must never block turning them on.
          registerForPushNotifications().catch(() => {});
          const subscriptions = await subscriptionsApi.getAll().catch(() => []);
          await syncLocalReminders(subscriptions);
        }
      } else {
        await setNotificationsOptOut(true);
        await cancelAllScheduledNotifications().catch(() => {});
        const token = await AsyncStorage.getItem("deviceToken");
        if (token) await removePushTokenFromServer(token).catch(() => {});
      }
    } catch (error) {
      console.error("Notification toggle failed:", error);
      setNotificationsEnabled(!value);
      await setNotificationsOptOut(!value).catch(() => {});
      Alert.alert(
        "Couldn't Update Notifications",
        getFriendlyErrorMessage(error, "We couldn't change your notification setting. Please try again."),
      );
    } finally {
      setNotificationsBusy(false);
    }
  };

  const handleOpenSystemSettings = () => Linking.openSettings();

  const handleRestorePurchase = async () => {
    setIsRestoring(true);
    try {
      await restorePremiumFromStore({ syncWithStore: true });
      await loadUser();
      Alert.alert("Premium Restored", "Your Premium subscription is active again.");
    } catch (error) {
      console.error("Restore purchase failed:", error);
      Alert.alert(
        "Couldn't Restore Purchase",
        getFriendlyErrorMessage(error, "We couldn't restore your purchase. Please try again later."),
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSignOut = async () => {
    const deviceToken = await AsyncStorage.getItem("deviceToken");
    if (deviceToken) {
      await removePushTokenFromServer(deviceToken).catch(() => {});
    }
    await cancelAllScheduledNotifications().catch(() => {});
    // No manual navigation here: the root layout sends signed-out users to
    // /login. Navigating too made the login screen open twice.
    await firebaseSignOut();
    setUser(null);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account?",
      "This permanently deletes your account and subscription data. Store subscriptions must still be cancelled through Apple or Google.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await userApi.deleteAccount();
              const deviceToken = await AsyncStorage.getItem("deviceToken");
              if (deviceToken) {
                await removePushTokenFromServer(deviceToken).catch(() => {});
              }
              await cancelAllScheduledNotifications().catch(() => {});
              await firebaseSignOut();
              setUser(null);
              Alert.alert("Account Deleted", "Your Substracker account was deleted.");
            } catch (error) {
              console.error("Failed to delete account:", error);
              Alert.alert(
                "Couldn't Delete Account",
                getFriendlyErrorMessage(error, "We couldn't delete your account. Please try again."),
              );
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  const initial = (user?.email?.trim().charAt(0) || firebaseUser?.email?.trim().charAt(0) || "?").toUpperCase();

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      <LinearGradient
        colors={colors.gradient.pageGlow as readonly [string, string, ...string[]]}
        style={styles.pageGlow}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Account</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.profileRow}>
            <LinearGradient
              colors={colors.gradient.mark as readonly [string, string, ...string[]]}
              style={styles.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.email, { color: colors.text.primary }]} numberOfLines={1}>
                {firebaseUser?.displayName || user?.email || firebaseUser?.email || "Account"}
              </Text>
              {firebaseUser?.displayName ? (
                <Text style={[styles.emailSub, { color: colors.text.muted }]} numberOfLines={1}>
                  {user?.email ?? firebaseUser?.email}
                </Text>
              ) : null}
              <View
                style={[
                  styles.planPill,
                  { backgroundColor: "rgba(255,255,255,0.08)" },
                ]}
              >
                <Text style={[styles.planPillText, { color: colors.text.muted }]}>
                  {user?.isPro ? "PREMIUM" : "FREE PLAN"}
                </Text>
              </View>
            </View>
            {!user?.isPro && (
              <TouchableOpacity
                style={[styles.upgradeChip, { backgroundColor: colors.accent.primary }]}
                onPress={() => router.push("/premium")}
              >
                <Text style={styles.upgradeChipText}>Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>NOTIFICATIONS</Text>
          <View style={[styles.card, { backgroundColor: colors.background.card }]}>
            <View style={[styles.row, { borderTopColor: colors.border.light, borderTopWidth: 0 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Renewal reminders</Text>
                <Text style={[styles.rowHint, { color: colors.text.muted }]}>
                  Get notified before you are charged
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.background.elevated, true: colors.accent.primary }}
                thumbColor="#FFF"
              />
            </View>
            <TouchableOpacity
              style={[styles.row, { borderTopColor: colors.border.light }]}
              onPress={handleOpenSystemSettings}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Open system settings</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: colors.background.card }]}>
            <View style={[styles.row, { borderTopColor: colors.border.light, borderTopWidth: 0 }]}>
              <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Version</Text>
              <Text style={[styles.rowValue, { color: colors.text.primary }]}>
                {Constants.expoConfig?.version ?? "—"}
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.background.card }]}>
            <TouchableOpacity
              style={[styles.row, { borderTopColor: colors.border.light, borderTopWidth: 0 }]}
              onPress={handleSignOut}
              disabled={isDeletingAccount}
            >
              <Text style={[styles.destructiveLabel, { color: colors.status.error }]}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.row, { borderTopColor: colors.border.light }]}
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              <Text style={[styles.destructiveLabel, { color: colors.status.error }]}>
                {isDeletingAccount ? "Deleting..." : "Delete Account"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleRestorePurchase} disabled={isRestoring} style={styles.restoreLink}>
            <Text style={[styles.restoreLinkText, { color: colors.accent.primary }]}>
              {isRestoring ? "Restoring..." : "Restore Purchase"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.4 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 110, gap: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  email: { fontSize: 17, fontWeight: "700", marginBottom: 2 },
  emailSub: { fontSize: 12.5, fontWeight: "500", marginBottom: 6 },
  planPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  planPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  upgradeChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  upgradeChipText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: -6, marginLeft: 2 },
  card: { borderRadius: 22, paddingHorizontal: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderTopWidth: 1,
  },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowValue: { fontSize: 15, fontWeight: "700" },
  rowHint: { fontSize: 12, fontWeight: "500", marginTop: 3 },
  destructiveLabel: { fontSize: 15, fontWeight: "700" },
  restoreLink: { alignItems: "center", paddingVertical: 6 },
  restoreLinkText: { fontSize: 14, fontWeight: "700" },
});
