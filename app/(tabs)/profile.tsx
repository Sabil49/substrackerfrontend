// app/(tabs)/profile.tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { User, userApi } from "@/services/api";
import {
    checkNotificationPermissions,
    registerForPushNotifications,
    removePushTokenFromServer,
    sendPushTokenToServer,
} from "@/services/notifications";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const token = await import("@/utils/storage").then((m) =>
        m.getAuthToken(),
      );
      if (token) {
        // logged in user
        const data = await userApi.get();
        setUser(data);
        setIsLoggedIn(true);
      } else {
        // no auth token means guest
        setUser(null);
        setIsLoggedIn(false);
      }
      const hasPermission = await checkNotificationPermissions();
      setNotificationsEnabled(hasPermission);
    } catch (error) {
      console.log("Could not load user profile (guest mode)");
      setUser(null);
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, []),
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
            Alert.alert(
              "Server Error",
              "Could not register device for notifications. Please try again.",
            );
            setNotificationsEnabled(false);
          }
        } else {
          Alert.alert(
            "Notifications Disabled",
            "Please enable notifications in your device settings",
          );
        }
      } catch (error) {
        console.error("Error during push notification registration:", error);
        Alert.alert(
          "Registration Error",
          "Failed to register for notifications. Please try again.",
        );
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
            Alert.alert(
              "Server Error",
              "Could not disable notifications on server. Please try again.",
            );
            setNotificationsEnabled(true);
            return;
          }
        }
        setNotificationsEnabled(false);
      } catch (error) {
        console.error("Error during notification removal:", error);
        Alert.alert(
          "Removal Error",
          "Failed to disable notifications. Please try again.",
        );
      }
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Profile
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          style={styles.settingsButton}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color={colors.text.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <LinearGradient
          colors={
            colors.gradient.primary as readonly [string, string, ...string[]]
          }
          style={styles.profileCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#FFF" />
          </View>
          <Text style={styles.profileName}>{user?.email ?? "Guest User"}</Text>
          <Text style={styles.profileStatus}>
            {user?.isPro ? "⭐ Premium Member" : "Free Plan"}
          </Text>
        </LinearGradient>

        {user && (
          <View style={styles.statsRow}>
            <View
              style={[
                styles.statBox,
                { backgroundColor: colors.background.card },
              ]}
            >
              <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {user.subscriptionCount}
              </Text>
              <Text
                style={[styles.statLabel, { color: colors.text.secondary }]}
              >
                Subscriptions
              </Text>
            </View>
            <View
              style={[
                styles.statBox,
                { backgroundColor: colors.background.card },
              ]}
            >
              <Text
                style={[
                  styles.statValue,
                  {
                    color: user.isPro
                      ? colors.status.success
                      : colors.text.primary,
                  },
                ]}
              >
                {user.isPro ? "∞" : String(user.subscriptionLimit ?? 5)}
              </Text>
              <Text
                style={[styles.statLabel, { color: colors.text.secondary }]}
              >
                Limit
              </Text>
            </View>
          </View>
        )}

        <View
          style={[styles.section, { backgroundColor: colors.background.card }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Preferences
          </Text>

          <View
            style={[
              styles.settingRow,
              { borderBottomColor: colors.border.light },
            ]}
          >
            <View style={styles.settingInfo}>
              <Text
                style={[styles.settingLabel, { color: colors.text.primary }]}
              >
                Notifications
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.text.secondary },
                ]}
              >
                Get reminded about upcoming payments
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{
                false: colors.border.default,
                true: colors.accent.primary,
              }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: colors.background.card }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Quick Actions
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={[
              styles.actionRow,
              { borderBottomColor: colors.border.light },
            ]}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={colors.accent.secondary}
            />
            <Text style={[styles.actionLabel, { color: colors.text.primary }]}>
              Settings
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.muted}
            />
          </TouchableOpacity>

          {!user?.isPro && (
            <TouchableOpacity
              onPress={() => router.push("/premium")}
              style={styles.actionRow}
            >
              <Ionicons
                name="star-outline"
                size={22}
                color={colors.accent.primary}
              />
              <Text
                style={[styles.actionLabel, { color: colors.text.primary }]}
              >
                Upgrade to Premium
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>

        {!user?.isPro && (
          <View
            style={[
              styles.premiumCard,
              {
                backgroundColor: colors.badge.silentBg,
                borderColor: colors.accent.primary,
              },
            ]}
          >
            <Text
              style={[styles.premiumTitle, { color: colors.accent.primary }]}
            >
              ⭐ Upgrade to Premium
            </Text>
            <Text
              style={[styles.premiumText, { color: colors.text.secondary }]}
            >
              {
                "• Unlimited subscriptions\n• Advanced analytics\n• Priority support"
              }
            </Text>
            <Button
              title="Upgrade Now"
              onPress={() => router.push("/premium")}
              style={styles.premiumButton}
            />
          </View>
        )}

        {/* auth action */}
        <View
          style={[styles.section, { backgroundColor: colors.background.card }]}
        >
          {isLoggedIn ? (
            <Button
              title="Sign Out"
              onPress={async () => {
                try {
                  await import("@/services/api").then((m) =>
                    m.authApi.logout(),
                  );
                } catch {}
                await import("@/utils/storage").then((m) => m.clearAuthToken());
                setUser(null);
                setIsLoggedIn(false);
                router.replace("/");
              }}
            />
          ) : (
            <Button
              title="Sign In / Sign Up"
              onPress={() => router.push("/login")}
            />
          )}
        </View>

        <View
          style={[styles.section, { backgroundColor: colors.background.card }]}
        >
          <Text style={[styles.versionText, { color: colors.text.muted }]}>
            SubTracker v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  profileCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  profileStatus: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  settingDescription: {
    fontSize: 12,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  premiumCard: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 2,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  premiumText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  premiumButton: {
    marginTop: 4,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});
