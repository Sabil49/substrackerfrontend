// app/settings.tsx
import { useTheme } from "@/contexts/ThemeContext";
import {
  cancelAllScheduledNotifications,
  getScheduledNotifications,
} from "@/services/notifications";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const handleTestNotification = async () => {
    try {
      const scheduled = await getScheduledNotifications();
      Alert.alert(
        "Notification Status",
        `You have ${scheduled.length} scheduled notification(s).\n\nNotifications are ${scheduled.length > 0 ? "active ✅" : "not set up yet ⚠️"}`,
      );
    } catch {
      Alert.alert("Error", "Failed to check notifications");
    }
  };

  const handleClearNotifications = () => {
    Alert.alert(
      "Clear Notifications",
      "This will cancel all scheduled notifications. They will be recreated when you next open the app.",
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

  const handleOpenSystemSettings = () => {
    Linking.openSettings();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Settings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Notifications Section */}
        <View
          style={[styles.section, { backgroundColor: colors.background.card }]}
        >
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={
                colors.gradient.accent as readonly [string, string, ...string[]]
              }
              style={styles.sectionIconGradient}
            >
              <Ionicons name="notifications" size={18} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Notifications
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleTestNotification}
            activeOpacity={0.7}
            style={[
              styles.settingRow,
              { borderBottomColor: colors.border.light },
            ]}
          >
            <View style={styles.settingInfo}>
              <Text
                style={[styles.settingLabel, { color: colors.text.primary }]}
              >
                Test Notifications
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.text.secondary },
                ]}
              >
                Check notification status
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.muted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleOpenSystemSettings}
            activeOpacity={0.7}
            style={[
              styles.settingRow,
              { borderBottomColor: colors.border.light },
            ]}
          >
            <View style={styles.settingInfo}>
              <Text
                style={[styles.settingLabel, { color: colors.text.primary }]}
              >
                System Settings
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.text.secondary },
                ]}
              >
                Open device notification settings
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClearNotifications}
            activeOpacity={0.7}
            style={styles.settingRow}
          >
            <View style={styles.settingInfo}>
              <Text
                style={[styles.settingLabel, { color: colors.text.primary }]}
              >
                Clear All Notifications
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.text.secondary },
                ]}
              >
                Cancel all scheduled reminders
              </Text>
            </View>
            <Ionicons
              name="trash-outline"
              size={20}
              color={colors.status.error}
            />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View
          style={[styles.section, { backgroundColor: colors.background.card }]}
        >
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={
                colors.gradient.secondary as readonly [
                  string,
                  string,
                  ...string[],
                ]
              }
              style={styles.sectionIconGradient}
            >
              <Ionicons name="information-circle" size={18} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              About
            </Text>
          </View>

          <View style={styles.aboutContent}>
            <Text style={[styles.aboutText, { color: colors.text.primary }]}>
              SubTracker v1.0.0
            </Text>
            <Text
              style={[
                styles.aboutDescription,
                { color: colors.text.secondary },
              ]}
            >
              Never miss a subscription payment
            </Text>
          </View>
        </View>

        {/* Tips Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.badge.silentBg,
              borderColor: colors.badge.silent,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={
                colors.gradient.success as readonly [
                  string,
                  string,
                  ...string[],
                ]
              }
              style={styles.sectionIconGradient}
            >
              <Ionicons name="bulb" size={18} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Notification Tips
            </Text>
          </View>

          <View style={styles.tipItem}>
            <View
              style={[
                styles.tipBullet,
                { backgroundColor: colors.badge.silent },
              ]}
            />
            <Text style={[styles.tipText, { color: colors.text.secondary }]}>
              Make sure notifications are enabled in device settings
            </Text>
          </View>

          <View style={styles.tipItem}>
            <View
              style={[
                styles.tipBullet,
                { backgroundColor: colors.badge.silent },
              ]}
            />
            <Text style={[styles.tipText, { color: colors.text.secondary }]}>
              Check that battery optimization is disabled
            </Text>
          </View>

          <View style={styles.tipItem}>
            <View
              style={[
                styles.tipBullet,
                { backgroundColor: colors.badge.silent },
              ]}
            />
            <Text style={[styles.tipText, { color: colors.text.secondary }]}>
              Keep the app updated for best reliability
            </Text>
          </View>

          <View style={styles.tipItem}>
            <View
              style={[
                styles.tipBullet,
                { backgroundColor: colors.badge.silent },
              ]}
            />
            <Text style={[styles.tipText, { color: colors.text.secondary }]}>
              Notifications work even when app is closed
            </Text>
          </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionIconGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
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
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    fontWeight: "500",
  },
  aboutContent: {
    alignItems: "center",
    paddingVertical: 8,
  },
  aboutText: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  aboutDescription: {
    fontSize: 13,
    fontWeight: "500",
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
