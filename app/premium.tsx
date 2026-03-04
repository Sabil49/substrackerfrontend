// app/premium.tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { getAuthToken } from "@/utils/storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as RNIap from "react-native-iap";
import { SafeAreaView } from "react-native-safe-area-context";

const FEATURES = [
  {
    icon: "∞",
    title: "Unlimited Subscriptions",
    description: "Track as many subscriptions as you need",
  },
  {
    icon: "🔔",
    title: "Smart Reminders",
    description: "Advanced notification system",
  },
  {
    icon: "📊",
    title: "Advanced Analytics",
    description: "Detailed spending insights and trends",
  },
  {
    icon: "☁️",
    title: "Cloud Backup",
    description: "Never lose your subscription data",
  },
  {
    icon: "🎨",
    title: "Custom Categories",
    description: "Organize subscriptions your way",
  },
  {
    icon: "📱",
    title: "Multi-Device Sync",
    description: "Access your data anywhere",
  },
];

const PRODUCT_IDS: Record<string, string> = {
  monthly: "com.substracker.monthly",
  yearly: "com.substracker.yearly",
};

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$4.99",
    period: "/month",
    popular: false,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$39.99",
    period: "/year",
    popular: true,
    savings: "Save 33%",
  },
];

export default function PremiumScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [iapInitialized, setIapInitialized] = useState(false);

  // listen to IAP events so we can handle purchase results
  React.useEffect(() => {
    const purchaseUpdateSub = RNIap.purchaseUpdatedListener(
      async (purchase) => {
        console.log("IAP purchase updated", purchase);
        try {
          const authToken = await getAuthToken();
          if (!authToken) {
            console.warn(
              "Received purchase update but no auth token available",
            );
            return;
          }

          if (process.env.EXPO_PUBLIC_PAYMENT_ENABLED) {
            // send receipt to backend for verification
            const verifyResponse = await fetch(
              `${process.env.EXPO_PUBLIC_API_URL}/api/user/verify-premium-purchase`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  planId: selectedPlan,
                  transactionId:
                    purchase.transactionId || purchase.purchaseToken,
                  receipt:
                    (purchase as any).transactionReceipt ||
                    purchase.transactionId ||
                    purchase.purchaseToken,
                }),
              },
            );

            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json();
              if (verifyData.isPro) {
                Alert.alert("Success", "Successfully upgraded to Premium!", [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } else {
                Alert.alert(
                  "Error",
                  "Payment verified but premium was not granted. Please contact support.",
                );
              }
            } else {
              const errorData = await verifyResponse.json().catch(() => ({}));
              Alert.alert(
                "Verification failed",
                errorData.message ||
                  "An error occurred verifying your purchase. Please contact support.",
              );
            }
          } else {
            // development mode - just simulate success
            Alert.alert("Success", "Premium feature enabled (dev mode)", [
              { text: "OK", onPress: () => router.back() },
            ]);
          }
        } catch (e) {
          console.error("Error processing purchase update", e);
          Alert.alert(
            "Purchase error",
            "There was a problem processing your purchase. Please try again later.",
          );
        }
      },
    );

    const purchaseErrorSub = RNIap.purchaseErrorListener((error) => {
      console.warn("IAP purchase error", error);
      Alert.alert(
        "Purchase error",
        error.message || "An error occurred during purchase.",
      );
    });

    return () => {
      purchaseUpdateSub.remove();
      purchaseErrorSub.remove();
      RNIap.endConnection();
    };
  }, [selectedPlan, router]);

  const handleUpgrade = async () => {
    // ensure IAP connection alive
    if (!iapInitialized) {
      try {
        await RNIap.initConnection();
        setIapInitialized(true);
      } catch (err) {
        console.error("RNIap init failed", err);
      }
    }
    setLoading(true);
    try {
      // Check authentication first — guests cannot purchase premium
      const authToken = await getAuthToken();
      if (!authToken) {
        Alert.alert(
          "Sign In Required",
          "You need to create an account or sign in to upgrade to Premium. Your existing subscriptions will be transferred to your account.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign In",
              onPress: () => router.push("/login?redirect=/premium"),
            },
          ],
        );
        return;
      }

      // TODO: PAYMENT INTEGRATION REQUIRED
      // This is a placeholder implementation. Before going live, integrate a real payment provider:
      // - Option 1: RevenueCat (https://www.revenuecat.com/) - recommended for mobile apps
      // - Option 2: Stripe with in-app purchases
      // - Option 3: Native IAP (Google Play Billing or Apple StoreKit)

      // dev branch variables are no longer needed; listener will handle success
      if (!process.env.EXPO_PUBLIC_PAYMENT_ENABLED) {
        console.warn(
          "[handleUpgrade] Payment is disabled in development. This must be enabled for production.",
        );
      } else {
        // use react-native-iap to purchase subscription
        try {
          const productId =
            PRODUCT_IDS[selectedPlan as keyof typeof PRODUCT_IDS];
          // For subscriptions, we use the generic requestPurchase API with type 'subs'.
          await RNIap.requestPurchase({
            request: {
              google: { skus: [productId] },
            },
            type: "subs",
          });
          // actual transaction details are available via purchaseUpdatedListener
          // we'll handle receipt/transaction in a listener or server-side verification
          console.log("Requested subscription for", productId);
        } catch (iapError) {
          console.error("[handleUpgrade] IAP error", iapError);
          throw new Error("Purchase failed. Please try again.");
        }
      }

      // For production we now handle receipt verification inside
      // the purchaseUpdatedListener registered above.  The listener
      // will send the purchase details to the backend and navigate
      // when the upgrade completes.  No further action is required here.
      if (!process.env.EXPO_PUBLIC_PAYMENT_ENABLED) {
        // skip server verification in dev mode
        console.warn(
          "[handleUpgrade] development mode - skipping verification and simulating success",
        );
        Alert.alert("Success", "Premium feature enabled (dev mode)", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error("[handleUpgrade] Error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to complete upgrade. Please try again or contact support.";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
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
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          Premium
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <LinearGradient
          colors={
            colors.gradient.accent as readonly [string, string, ...string[]]
          }
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.heroIcon}>⭐</Text>
          <Text style={styles.heroTitle}>Upgrade to Premium</Text>
          <Text style={styles.heroSubtitle}>
            Unlock all features and take full control
          </Text>
        </LinearGradient>

        <View style={styles.plansSection}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Choose Your Plan
          </Text>
          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor:
                    selectedPlan === plan.id
                      ? colors.accent.primary
                      : colors.border.default,
                  borderWidth: selectedPlan === plan.id ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <View
                  style={[
                    styles.popularBadge,
                    { backgroundColor: colors.accent.primary },
                  ]}
                >
                  <Text style={styles.popularText}>BEST VALUE</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text
                    style={[styles.planName, { color: colors.text.primary }]}
                  >
                    {plan.name}
                  </Text>
                  {"savings" in plan && plan.savings && (
                    <Text
                      style={[styles.savings, { color: colors.status.success }]}
                    >
                      {plan.savings}
                    </Text>
                  )}
                </View>
                <View style={styles.planPricing}>
                  <Text
                    style={[styles.planPrice, { color: colors.text.primary }]}
                  >
                    {plan.price}
                  </Text>
                  <Text
                    style={[
                      styles.planPeriod,
                      { color: colors.text.secondary },
                    ]}
                  >
                    {plan.period}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  {
                    borderColor:
                      selectedPlan === plan.id
                        ? colors.accent.primary
                        : colors.border.default,
                  },
                ]}
              >
                {selectedPlan === plan.id && (
                  <View
                    style={[
                      styles.radioInner,
                      { backgroundColor: colors.accent.primary },
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Everything Included
          </Text>
          {FEATURES.map((feature, index) => (
            <View
              key={index}
              style={[
                styles.featureRow,
                { backgroundColor: colors.background.card },
              ]}
            >
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureText}>
                <Text
                  style={[styles.featureTitle, { color: colors.text.primary }]}
                >
                  {feature.title}
                </Text>
                <Text
                  style={[
                    styles.featureDescription,
                    { color: colors.text.secondary },
                  ]}
                >
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Button
          title={loading ? "Processing..." : "Continue"}
          onPress={handleUpgrade}
          disabled={loading}
          style={styles.upgradeButton}
        />

        <Text style={[styles.terms, { color: colors.text.muted }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
          Subscriptions auto-renew unless cancelled.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", letterSpacing: 0.3 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    borderRadius: 28,
    padding: 40,
    alignItems: "center",
    marginBottom: 28,
  },
  heroIcon: { fontSize: 56, marginBottom: 16 },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 8,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  plansSection: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  planCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  planInfo: { flex: 1 },
  planName: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  savings: { fontSize: 13, fontWeight: "600" },
  planPricing: { alignItems: "flex-end" },
  planPrice: { fontSize: 24, fontWeight: "800", letterSpacing: 0.3 },
  planPeriod: { fontSize: 13, fontWeight: "500" },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  featuresSection: { marginBottom: 28 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    gap: 14,
  },
  featureIcon: { fontSize: 28 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  featureDescription: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  upgradeButton: { marginBottom: 16 },
  terms: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
