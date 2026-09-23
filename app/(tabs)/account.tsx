// app/(tabs)/account.tsx
// Merged Profile + Settings into one Account screen, matching Account.png.
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage, User, userApi } from "@/services/api";
import {
  checkNotificationPermissions,
  registerForPushNotifications,
  removePushTokenFromServer,
  sendPushTokenToServer,
  cancelAllScheduledNotifications,
  getScheduledNotifications,
} from "@/services/notifications";
import { restorePremiumFromStore } from "@/services/premium";
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadUser = async () => {
    try {
      const data = await userApi.get();
      setUser(data);
      const hasPermission = await checkNotificationPermissions();
      setNotificationsEnabled(hasPermission);
    } catch {
      console.log("Could not load user profile");
      setUser(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUser();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firebaseUser]),
  );

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      try {
        const token = await registerForPushNotifications();
        if (token) {
          try {
            await sendPushTokenToServer(token);
            setNotificationsEnabled(true);
          } catch (error) {
            console.error("Failed to send token to server:", error);
            Alert.alert("Server Error", "Could not register device for notifications. Please try again.");
            setNotificationsEnabled(false);
          }
        } else {
          Alert.alert("Notifications Disabled", "Please enable notifications in your device settings");
        }
      } catch (error) {
        console.error("Error during push notification registration:", error);
        Alert.alert("Registration Error", "Failed to register for notifications. Please try again.");
        setNotificationsEnabled(false);
      }
    } else {
      try {
        const token = await AsyncStorage.getItem("deviceToken");
        if (token) {
          try {
            await removePushTokenFromServer(token);
          } catch (error) {
            console.error("Failed to remove token from server:", error);
            Alert.alert("Server Error", "Could not disable notifications on server. Please try again.");
            setNotificationsEnabled(true);
            return;
          }
        }
        setNotificationsEnabled(false);
      } catch (error) {
        console.error("Error during notification removal:", error);
        Alert.alert("Removal Error", "Failed to disable notifications. Please try again.");
      }
    }
  };

  const handleTestNotification = async () => {
    try {
      const [scheduled, permissionsEnabled] = await Promise.all([
        getScheduledNotifications(),
        checkNotificationPermissions(),
      ]);
      Alert.alert(
        "Notification Status",
        `Device notifications are ${permissionsEnabled ? "enabled" : "disabled"}.\n\nLocal scheduled reminders on this device: ${scheduled.length}.`,
      );
    } catch {
      Alert.alert("Error", "Failed to check notifications");
    }
  };

  const handleClearNotifications = () => {
    Alert.alert(
      "Clear Local Notifications",
      "This will cancel local scheduled notifications on this device. Server push reminders are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelAllScheduledNotifications();
              Alert.alert("Success", "All notifications cleared");
            } catch {
              Alert.alert("Error", "Failed to clear notifications");
            }
          },
        },
      ],
    );
  };

  const handleOpenSystemSettings = () => Linking.openSettings();

  const handleRestorePurchase = async () => {
    setIsRestoring(true);
    try {
      await restorePremiumFromStore();
      await loadUser();
      Alert.alert("Success", "Premium restored successfully!");
    } catch (error) {
      Alert.alert(
        "Restore Error",
        getFriendlyErrorMessage(error, "There was a problem restoring your purchase. Please try again later."),
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
    await firebaseSignOut();
    setUser(null);
    router.replace("/login");
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
              await firebaseSignOut();
              setUser(null);
              Alert.alert("Account Deleted", "Your Substracker account was deleted.");
              router.replace("/login");
            } catch (error) {
              console.error("Failed to delete account:", error);
              Alert.alert(
                "Could Not Delete Account",
                getFriendlyErrorMessage(error, "We could not delete your account. Please try again."),
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

          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>PREFERENCES</Text>
          <View style={[styles.card, { backgroundColor: colors.background.card }]}>
            <View style={[styles.row, { borderTopColor: colors.border.light, borderTopWidth: 0 }]}>
              <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Notifications</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.background.elevated, true: colors.accent.primary }}
                thumbColor="#FFF"
              />
            </View>
            <View style={[styles.row, { borderTopColor: colors.border.light }]}>
              <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Currency</Text>
              <View style={styles.valueChevron}>
                <Text style={[styles.rowValue, { color: colors.text.primary }]}>USD</Text>
                <Ionicons name="chevron-down" size={14} color={colors.text.muted} />
              </View>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>NOTIFICATIONS</Text>
          <View style={[styles.card, { backgroundColor: colors.background.card }]}>
            <TouchableOpacity
              style={[styles.row, { borderTopColor: colors.border.light, borderTopWidth: 0 }]}
              onPress={handleTestNotification}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Send test notification</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.row, { borderTopColor: colors.border.light }]}
              onPress={handleOpenSystemSettings}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Open system settings</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.row, { borderTopColor: colors.border.light }]}
              onPress={handleClearNotifications}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>Clear local notifications</Text>
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
  valueChevron: { flexDirection: "row", alignItems: "center", gap: 6 },
  destructiveLabel: { fontSize: 15, fontWeight: "700" },
  restoreLink: { alignItems: "center", paddingVertical: 6 },
  restoreLinkText: { fontSize: 14, fontWeight: "700" },
});
