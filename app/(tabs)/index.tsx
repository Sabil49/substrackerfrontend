// app/(tabs)/index.tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { Subscription, subscriptionsApi } from "@/services/api";
import { formatCurrency, formatShortDate, getDaysUntil } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function getMonthlyAmount(subscription: Subscription) {
  const amount = Number(subscription.amount) || 0;
  const cycle = subscription.billingCycle.toLowerCase();

  if (cycle === "weekly") return amount * 4.33;
  if (cycle === "yearly") return amount / 12;
  if (cycle === "custom" && subscription.customCycleDays) {
    return (amount * 30) / subscription.customCycleDays;
  }
  return amount;
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async () => {
    try {
      setError(null);
      const data = await subscriptionsApi.getAll();
      setSubscriptions(data);
    } catch (err: any) {
      console.error("Failed to load subscriptions:", err);
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to connect to server";
      setError(errorMessage);
      if (!loading) Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
    }, [loadSubscriptions]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSubscriptions();
  };

  const activeSubscriptions = useMemo(
    () =>
      subscriptions
        .filter((item) => !item.isCanceled)
        .sort((a, b) => getDaysUntil(a.nextBillingDate) - getDaysUntil(b.nextBillingDate)),
    [subscriptions],
  );

  const monthlyTotal = useMemo(
    () => activeSubscriptions.reduce((total, item) => total + getMonthlyAmount(item), 0),
    [activeSubscriptions],
  );

  const trialEndingSoon = useMemo(
    () =>
      activeSubscriptions.filter((item) => {
        if (!item.isTrial || !item.trialEndDate) return false;
        const daysUntilTrialEnds = getDaysUntil(item.trialEndDate);
        return daysUntilTrialEnds >= 0 && daysUntilTrialEnds <= 7;
      }),
    [activeSubscriptions],
  );

  const reviewCandidates = useMemo(
    () =>
      activeSubscriptions.filter(
        (item) =>
          item.isSilent ||
          item.valueScore === "unused" ||
          (!item.lastReviewedAt && getDaysUntil(item.nextBillingDate) > 30),
      ),
    [activeSubscriptions],
  );

  const potentialMonthlySavings = useMemo(
    () => reviewCandidates.reduce((total, item) => total + getMonthlyAmount(item), 0),
    [reviewCandidates],
  );

  const openImport = () => router.push("/import-subscription");

  const renderTrialGuard = () => {
    if (trialEndingSoon.length === 0) return null;
    const first = trialEndingSoon[0];
    const daysLeft = getDaysUntil(first.trialEndDate!);
    return (
      <LinearGradient
        colors={colors.gradient.guard as readonly [string, string, ...string[]]}
        style={styles.guardCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.guardTop}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
          <Text style={styles.guardTitle}>Trial Guard</Text>
        </View>
        <Text style={styles.guardBody}>
          {trialEndingSoon.length === 1
            ? `${first.name} trial ends in ${daysLeft}d — we'll flag it before you're charged.`
            : `${trialEndingSoon.length} trials end this week — we'll flag them before you're charged.`}
        </Text>
        <TouchableOpacity style={styles.guardPill} onPress={openImport} activeOpacity={0.85}>
          <Ionicons name="layers-outline" size={16} color="#fff" />
          <Text style={styles.guardPillText}>Scan a screenshot — free</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  };

  const renderRow = (item: Subscription, index: number) => {
    const daysUntil = getDaysUntil(item.nextBillingDate);
    const rowColor = item.color || colors.background.elevated;
    const isLast = index === activeSubscriptions.length - 1;
    const nameInitial = (item.name?.trim().charAt(0) || "?").toUpperCase();
    const subtitle = item.isTrial && item.trialEndDate
      ? `Free until ${formatShortDate(item.trialEndDate)}`
      : `Next payment on ${formatShortDate(item.nextBillingDate)}`;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.subRow,
          { backgroundColor: rowColor },
          !isLast && { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.25)" },
        ]}
        onPress={() => router.push(`/subscription/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.subIconChip}>
          <Text style={styles.subIconText}>{nameInitial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.subName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.subSubtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        {item.isTrial ? (
          <View style={styles.trialPill}>
            <Text style={styles.trialPillText}>Trial</Text>
          </View>
        ) : (
          <Text style={styles.subPrice}>{formatCurrency(Number(item.amount), item.currency)}</Text>
        )}
        {daysUntil <= 3 && daysUntil >= 0 && (
          <View style={styles.dueDot} />
        )}
      </TouchableOpacity>
    );
  };

  const renderDashboard = () => {
    if (!activeSubscriptions.length) return null;

    return (
      <View style={styles.dashboard}>
        {renderTrialGuard()}

        <View style={styles.sectionLabelRow}>
          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>THIS MONTH</Text>
          {potentialMonthlySavings > 0 && (
            <Text style={[styles.savingsHint, { color: colors.status.success }]}>
              Up to {formatCurrency(potentialMonthlySavings, "USD")}/mo to review
            </Text>
          )}
        </View>

        <View style={styles.listCard}>
          {activeSubscriptions.map((item, index) => renderRow(item, index))}
        </View>

        <View style={[styles.totalRow, { backgroundColor: colors.background.card }]}>
          <View>
            <Text style={[styles.totalLabel, { color: colors.text.primary }]}>
              Total {formatCurrency(monthlyTotal, "USD")}
            </Text>
            <Text style={[styles.totalSub, { color: colors.text.muted }]}>Monthly</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="receipt-outline" size={44} color={colors.accent.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No subscriptions yet</Text>
      <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
        Add your first subscription to start tracking recurring payments.
      </Text>
      <Button title="Add Subscription" onPress={() => router.push("/add-subscription")} style={styles.emptyButton} />
      <Button title="Scan a screenshot — free" onPress={openImport} variant="secondary" style={styles.emptyButton} />
    </View>
  );

  const renderError = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="warning-outline" size={56} color={colors.status.warning} />
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Connection Error</Text>
      <Text style={[styles.emptyText, { color: colors.text.secondary }]}>{error || "Failed to connect to server"}</Text>
      <Button title="Retry" onPress={() => { setLoading(true); loadSubscriptions(); }} style={styles.emptyButton} />
      <Button title="Add Subscription Anyway" onPress={() => router.push("/add-subscription")} variant="secondary" style={styles.emptyButton} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      <LinearGradient
        colors={colors.gradient.pageGlow as readonly [string, string, ...string[]]}
        style={styles.pageGlow}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Subscriptions</Text>
          <View style={styles.headerIcon}>
            <Ionicons name="cloud-outline" size={20} color={colors.text.secondary} />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.primary} />
          </View>
        ) : error && subscriptions.length === 0 ? (
          renderError()
        ) : (
          <FlatList
            data={[]}
            renderItem={null}
            keyExtractor={() => "x"}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={activeSubscriptions.length ? renderDashboard : renderEmpty}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
          />
        )}

        {activeSubscriptions.length > 0 && (
          <View style={styles.fabContainer}>
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: colors.accent.primary }]}
              onPress={() => router.push("/add-subscription")}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center", alignItems: "center",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingHorizontal: 20, paddingBottom: 110 },
  dashboard: { gap: 16 },
  guardCard: { borderRadius: 26, padding: 20, gap: 12 },
  guardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  guardTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  guardBody: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.92)", lineHeight: 20 },
  guardPill: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.22)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
  },
  guardPillText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  savingsHint: { fontSize: 12, fontWeight: "700" },
  listCard: { borderRadius: 26, overflow: "hidden" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  subIconChip: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center", alignItems: "center",
  },
  subIconText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  subName: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 3 },
  subSubtitle: { fontSize: 12.5, fontWeight: "600", color: "rgba(255,255,255,0.78)" },
  subPrice: { fontSize: 16, fontWeight: "800", color: "#fff" },
  trialPill: { backgroundColor: "rgba(255,255,255,0.22)", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 10 },
  trialPillText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  dueDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#F59E0B", marginLeft: 4 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 22, padding: 18 },
  totalLabel: { fontSize: 17, fontWeight: "800", marginBottom: 3 },
  totalSub: { fontSize: 12, fontWeight: "600" },
  emptyContainer: { alignItems: "center", paddingTop: 90, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44, marginBottom: 20,
    backgroundColor: "rgba(59,130,246,0.12)", justifyContent: "center", alignItems: "center",
  },
  emptyTitle: { fontSize: 19, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 19 },
  emptyButton: { width: "100%", maxWidth: 300, marginBottom: 10 },
  fabContainer: { position: "absolute", bottom: 20, right: 20 },
  fab: {
    width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center",
    shadowColor: "#3B82F6", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 8,
  },
});
