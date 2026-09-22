// app/subscription/[id].tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { Subscription, subscriptionsApi } from "@/services/api";
import { cancelLocalNotificationsForSubscription } from "@/services/notifications";
import { formatCurrency, formatDate, getDaysUntil } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STORE_URLS = {
  ios: "https://apps.apple.com/account/subscriptions",
  android: "https://play.google.com/store/account/subscriptions",
};

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [fadeAnim] = useState(new Animated.Value(0));

  const loadSubscription = useCallback(async () => {
    if (!id) return;

    try {
      const data = await subscriptionsApi.getOne(id);
      setSubscription(data);
    } catch {
      Alert.alert("Error", "Failed to load subscription");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    if (subscription) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [subscription, fadeAnim]);

  const handleMarkReviewed = async () => {
    if (!subscription || !id) return;
    try {
      const updated = await subscriptionsApi.markReviewed(id);
      setSubscription(updated);
      Alert.alert("✓ Reviewed", "Subscription marked as reviewed");
    } catch {
      Alert.alert("Error", "Failed to mark as reviewed");
    }
  };
  const handleLogUsage = async () => {
    if (!subscription) return;
    try {
      const updated = await subscriptionsApi.logUsage(id!);
      setSubscription(updated);
      Alert.alert("✓ Logged", "Usage recorded successfully");
    } catch {
      Alert.alert("Error", "Failed to log usage");
    }
  };

  const handleOpenCancelPage = async () => {
    const storeUrl =
      Platform.OS === "ios" ? STORE_URLS.ios : STORE_URLS.android;

    try {
      const canOpen = await Linking.canOpenURL(storeUrl);
      if (canOpen) {
        await Linking.openURL(storeUrl);
        setCancelModalVisible(true);
      } else {
        Alert.alert("Error", "Cannot open store page");
      }
    } catch {
      Alert.alert("Error", "Failed to open store page");
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    try {
      const updated = await subscriptionsApi.cancel(id!, cancelReason);
      await cancelLocalNotificationsForSubscription(id!, subscription.name);
      setSubscription(updated);
      setCancelModalVisible(false);
      Alert.alert("✓ Canceled", "Subscription marked as canceled");
    } catch {
      Alert.alert("Error", "Failed to cancel subscription");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Subscription",
      "This will permanently delete this subscription.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await subscriptionsApi.delete(id!);
              await cancelLocalNotificationsForSubscription(
                id!,
                subscription?.name,
              );
              router.back();
            } catch {
              Alert.alert("Error", "Failed to delete subscription");
            }
          },
        },
      ],
    );
  };

  const getCostPerUse = () => {
    if (
      !subscription ||
      !subscription.usageCount ||
      subscription.usageCount === 0
    )
      return null;
    const cost = subscription.amount / subscription.usageCount;
    return formatCurrency(cost, subscription.currency);
  };

  const getValueScoreInfo = () => {
    if (
      !subscription ||
      !subscription.usageCount ||
      subscription.usageCount === 0
    ) {
      return { label: "No usage data yet", color: colors.text.muted };
    }

    // Use currency-agnostic percentage-based scoring
    // costPerUse / totalAmount = percentage of subscription cost per use
    // This works for any currency without needing conversion
    const costPerUse = subscription.amount / subscription.usageCount;
    const percentageOfTotal = costPerUse / subscription.amount;

    // Thresholds based on percentage of subscription amount:
    // < 0.05 (5%) = Worth it - Great value (highly reusable)
    // < 0.20 (20%) = Fair value (moderate reuse)
    // >= 0.20 (20%) = Overpriced (low reuse, high cost per use)
    if (percentageOfTotal < 0.05) {
      return { label: "✓ Worth it - Great value", color: colors.badge.worthIt };
    }
    if (percentageOfTotal < 0.2) {
      return { label: "○ Fair value", color: colors.badge.fairValue };
    }
    return {
      label: "! Overpriced - Consider canceling",
      color: colors.badge.overpriced,
    };
  };

  if (loading || !subscription) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.background.primary },
        ]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loading, { color: colors.text.primary }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  const daysUntil = getDaysUntil(subscription.nextBillingDate);
  const valueInfo = getValueScoreInfo();

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
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {!subscription.isCanceled && (
            <TouchableOpacity
              onPress={() => router.push(`/add-subscription?id=${id}`)}
              style={styles.headerIconButton}
            >
              <Ionicons name="pencil-outline" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete} style={styles.headerIconButton}>
            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryIcon,
                { backgroundColor: subscription.color || colors.background.elevated },
              ]}
            >
              <Text style={styles.summaryIconText}>
                {subscription.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryName, { color: colors.text.primary }]} numberOfLines={1}>
                {subscription.name}
              </Text>
              <Text style={[styles.summaryPrice, { color: colors.text.secondary }]}>
                {formatCurrency(subscription.amount, subscription.currency)} /{" "}
                {subscription.billingCycle.toLowerCase()}
              </Text>
            </View>
          </View>

          {subscription.isCanceled ? (
            <View style={[styles.statusPill, { backgroundColor: colors.background.card }]}>
              <Ionicons name="checkmark-circle" size={15} color={colors.status.success} />
              <Text style={[styles.statusPillText, { color: colors.status.success }]}>Canceled</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, { backgroundColor: `${valueInfo.color}22` }]}>
              <Text style={[styles.statusPillText, { color: valueInfo.color }]}>{valueInfo.label}</Text>
            </View>
          )}

          <View style={[styles.infoCard, { backgroundColor: colors.background.card }]}>
            <View style={[styles.infoRow, { borderBottomColor: colors.border.light }]}>
              <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Next billing</Text>
              <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                {formatDate(subscription.nextBillingDate)} ({daysUntil}d)
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: colors.border.light }]}>
              <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Category</Text>
              <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                {subscription.category
                  ? subscription.category.charAt(0).toUpperCase() + subscription.category.slice(1)
                  : "Other"}
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: colors.border.light }]}>
              <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Start date</Text>
              <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                {formatDate(subscription.startDate)}
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Billing cycle</Text>
              <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                {subscription.billingCycle === "custom"
                  ? `Every ${subscription.customCycleDays} days`
                  : subscription.billingCycle.charAt(0).toUpperCase() + subscription.billingCycle.slice(1)}
              </Text>
            </View>
          </View>

          {!subscription.isCanceled && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.background.card }]}
                onPress={handleLogUsage}
                activeOpacity={0.85}
              >
                <Ionicons name="list-outline" size={17} color={colors.text.primary} />
                <Text style={[styles.actionButtonText, { color: colors.text.primary }]}>Log usage</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${colors.status.error}1A` }]}
                onPress={handleOpenCancelPage}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle-outline" size={17} color={colors.status.error} />
                <Text style={[styles.actionButtonText, { color: colors.status.error }]}>
                  Cancel subscription
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {subscription.isSilent && !subscription.isCanceled && (
            <View
              style={[
                styles.alertCard,
                {
                  backgroundColor: colors.badge.silentBg,
                  borderColor: colors.badge.silent,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.alertHeader}>
                <Ionicons
                  name="alert-circle"
                  size={24}
                  color={colors.badge.silent}
                />
                <Text
                  style={[styles.alertTitle, { color: colors.badge.silent }]}
                >
                  Silent Subscription Detected
                </Text>
              </View>
              <Text
                style={[styles.alertText, { color: colors.text.secondary }]}
              >
                This subscription hasn&apos;t been reviewed in over 30 days.
                Review it to confirm you still need it.
              </Text>
              <Button
                title="✓ Mark as Reviewed"
                onPress={handleMarkReviewed}
                style={styles.alertButton}
              />
            </View>
          )}

          {subscription.receiptImageUrl && (
            <TouchableOpacity
              style={[styles.section, { backgroundColor: colors.background.card }]}
              onPress={() => Linking.openURL(subscription.receiptImageUrl!)}
              activeOpacity={0.85}
            >
              <View style={styles.sectionHeader}>
                <LinearGradient
                  colors={colors.gradient.secondary as readonly [string, string, ...string[]]}
                  style={styles.sectionIconGradient}
                >
                  <Ionicons name="receipt" size={18} color="#FFF" />
                </LinearGradient>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  Original Receipt
                </Text>
              </View>
              <Image
                source={{ uri: subscription.receiptImageUrl }}
                style={styles.receiptThumbnail}
                resizeMode="cover"
              />
              <Text style={[styles.alertText, { color: colors.accent.primary, marginTop: 8 }]}>
                View full image
              </Text>
            </TouchableOpacity>
          )}

          {subscription.usageCount !== undefined &&
            subscription.usageCount > 0 && (
              <View
                style={[
                  styles.section,
                  { backgroundColor: colors.background.card },
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
                    <Ionicons name="analytics" size={18} color="#FFF" />
                  </LinearGradient>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.text.primary },
                    ]}
                  >
                    Value Analysis
                  </Text>
                </View>

                <View style={styles.valueMetrics}>
                  <View
                    style={[
                      styles.metric,
                      { backgroundColor: colors.background.elevated },
                    ]}
                  >
                    <Text
                      style={[
                        styles.metricValue,
                        { color: colors.text.primary },
                      ]}
                    >
                      {subscription.usageCount}
                    </Text>
                    <Text
                      style={[
                        styles.metricLabel,
                        { color: colors.text.secondary },
                      ]}
                    >
                      Times Used
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.metric,
                      { backgroundColor: colors.background.elevated },
                    ]}
                  >
                    <Text
                      style={[
                        styles.metricValue,
                        { color: colors.text.primary },
                      ]}
                    >
                      {getCostPerUse()}
                    </Text>
                    <Text
                      style={[
                        styles.metricLabel,
                        { color: colors.text.secondary },
                      ]}
                    >
                      Per Use
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.valueScoreBadge,
                    { backgroundColor: `${valueInfo.color}33` },
                  ]}
                >
                  <Text
                    style={[styles.valueScoreText, { color: valueInfo.color }]}
                  >
                    {valueInfo.label}
                  </Text>
                </View>

                <Button
                  title="✓ Used Today"
                  onPress={handleLogUsage}
                  variant="secondary"
                  style={styles.usageButton}
                />
              </View>
            )}

          {!subscription.usageCount && !subscription.isCanceled && (
            <View
              style={[
                styles.section,
                { backgroundColor: colors.background.card },
              ]}
            >
              <View style={styles.sectionHeader}>
                <LinearGradient
                  colors={
                    colors.gradient.accent as readonly [
                      string,
                      string,
                      ...string[],
                    ]
                  }
                  style={styles.sectionIconGradient}
                >
                  <Ionicons name="trending-up" size={18} color="#FFF" />
                </LinearGradient>
                <Text
                  style={[styles.sectionTitle, { color: colors.text.primary }]}
                >
                  Track Usage
                </Text>
              </View>
              <Text
                style={[styles.sectionText, { color: colors.text.secondary }]}
              >
                Track usage to see if this subscription is worth the cost.
              </Text>
              <Button
                title="✓ Used Today"
                onPress={handleLogUsage}
                style={styles.usageButton}
              />
            </View>
          )}

          {!subscription.isCanceled && (
            <View
              style={[
                styles.section,
                { backgroundColor: colors.background.card },
              ]}
            >
              <View style={styles.sectionHeader}>
                <LinearGradient
                  colors={
                    colors.gradient.danger as readonly [
                      string,
                      string,
                      ...string[],
                    ]
                  }
                  style={styles.sectionIconGradient}
                >
                  <Ionicons name="close-circle" size={18} color="#FFF" />
                </LinearGradient>
                <Text
                  style={[styles.sectionTitle, { color: colors.text.primary }]}
                >
                  Cancel Subscription
                </Text>
              </View>

              <Text
                style={[styles.sectionText, { color: colors.text.secondary }]}
              >
                We&apos;ll open your{" "}
                {Platform.OS === "ios" ? "App Store" : "Play Store"}{" "}
                subscriptions page where you can cancel.
              </Text>

              <Button
                title={`Open ${Platform.OS === "ios" ? "App Store" : "Play Store"}`}
                onPress={handleOpenCancelPage}
                variant="secondary"
                style={styles.cancelButton}
              />
            </View>
          )}

          {subscription.isCanceled && subscription.cancelReason && (
            <View
              style={[
                styles.section,
                { backgroundColor: colors.background.card },
              ]}
            >
              <Text
                style={[styles.sectionTitle, { color: colors.text.primary }]}
              >
                Cancellation Reason
              </Text>
              <Text
                style={[styles.sectionText, { color: colors.text.secondary }]}
              >
                {subscription.cancelReason}
              </Text>
            </View>
          )}

          {subscription.notes && (
            <View
              style={[
                styles.section,
                { backgroundColor: colors.background.card },
              ]}
            >
              <Text
                style={[styles.sectionTitle, { color: colors.text.primary }]}
              >
                Notes
              </Text>
              <Text
                style={[styles.sectionText, { color: colors.text.secondary }]}
              >
                {subscription.notes}
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background.card },
            ]}
          >
            <View style={styles.modalHeader}>
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={colors.status.success}
              />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
              Did you cancel?
            </Text>
            <Text style={[styles.modalText, { color: colors.text.secondary }]}>
              If you canceled your subscription in the store, mark it as
              canceled here.
            </Text>

            <Text style={[styles.modalLabel, { color: colors.text.secondary }]}>
              Why did you cancel? (Optional)
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background.elevated,
                  color: colors.text.primary,
                  borderColor: colors.border.default,
                },
              ]}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Too expensive, not using enough, etc."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.background.elevated },
                ]}
                onPress={() => setCancelModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: colors.text.primary },
                  ]}
                >
                  Not Yet
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.status.success },
                ]}
                onPress={handleCancelSubscription}
              >
                <Text style={[styles.modalButtonText, { color: "#FFF" }]}>
                  ✓ Mark Canceled
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loading: {
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryIconText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFF",
  },
  summaryName: {
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 3,
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  infoCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 15,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  alertCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  alertText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  alertButton: {
    marginTop: 8,
  },
  receiptThumbnail: {
    width: "100%",
    height: 160,
    borderRadius: 14,
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
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  valueMetrics: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  valueScoreBadge: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  valueScoreText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  usageButton: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cancelButton: {
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    padding: 28,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  modalText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: "center",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
