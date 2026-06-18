// app/premium.tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { API_URL } from "@/services/api";
import { getAuthToken, getGuestId } from "@/utils/storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as RNIap from "react-native-iap";
import { SafeAreaView } from "react-native-safe-area-context";

const SUBSCRIPTION_SKUS = [
  "com.substracker.premium.monthly",
  "com.substracker.premium.yearly",
];

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

const PRODUCTS = [
  {
    id: "monthly",
    name: "Monthly",
    productId: "com.substracker.premium.monthly",
    price: "$4.99",
    period: "/month",
    popular: false,
  },
  {
    id: "yearly",
    name: "Yearly",
    productId: "com.substracker.premium.yearly",
    price: "$39.99",
    period: "/year",
    popular: true,
    savings: "Save 33%",
  },
];

const PRODUCT_PLAN_MAP = {
  "com.substracker.premium.monthly": "monthly",
  "com.substracker.premium.yearly": "yearly",
} as const;

type PlanId = (typeof PRODUCTS)[number]["id"];

const getStoreProductId = (item: any) =>
  item?.id || item?.productId || item?.sku || item?.productIdAndroid;

const getPurchasePlanId = (purchase: any, fallback: PlanId) => {
  const productId = purchase.productId || purchase.sku || purchase.productIdAndroid;
  return (
    (productId && PRODUCT_PLAN_MAP[productId as keyof typeof PRODUCT_PLAN_MAP]) ||
    fallback
  );
};

const verifyPurchaseWithBackend = async (
  purchase: any,
  planId: string,
  authToken: string | null,
  guestId?: string,
) => {
  const purchaseToken = purchase.purchaseToken || purchase.transactionId;
  const receipt =
    purchase.transactionReceipt || purchase.purchaseToken || purchase.transactionId;

  return fetch(`${API_URL}/api/user/verify-premium-purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      planId,
      purchaseToken,
      receipt,
      platform: Platform.OS === "ios" ? "ios" : "android",
      ...(guestId ? { guestId } : {}),
    }),
  });
};

const finishPurchase = async (purchase: any) => {
  try {
    await (RNIap as any).finishTransaction({
      purchase,
      isConsumable: false,
    });
  } catch (err) {
    console.warn("Failed to finish transaction", err);
  }
};

export default function PremiumScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>("yearly");
  const [loading, setLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);

  const currentPlanRef = useRef<PlanId>("yearly");

  useEffect(() => {
    currentPlanRef.current = selectedPlan;
  }, [selectedPlan]);

  useEffect(() => {
    const initIAP = async () => {
      try {
        await RNIap.initConnection();

        const products = await (RNIap as any).fetchProducts({
          skus: SUBSCRIPTION_SKUS,
          type: "subs",
        });

        console.log("IAP PRODUCTS:", JSON.stringify(products, null, 2));
        setStoreProducts(products || []);
      } catch (err) {
        console.error("RNIap init/products failed", err);
      }
    };

    initIAP();

    const purchaseUpdateSub = RNIap.purchaseUpdatedListener(async (purchase) => {
      console.log("IAP purchase updated", purchase);
      const planId = getPurchasePlanId(purchase, currentPlanRef.current);

      try {
        const authToken = await getAuthToken();
        const guestId = authToken ? undefined : await getGuestId();

        if (!process.env.EXPO_PUBLIC_PAYMENT_ENABLED) {
          await finishPurchase(purchase);
          Alert.alert("Success", "Premium feature enabled (dev mode)", [
            { text: "OK", onPress: () => router.back() },
          ]);
          return;
        }

        const verifyResponse = await verifyPurchaseWithBackend(
          purchase,
          planId,
          authToken,
          guestId,
        );

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              "Payment verification failed. Please contact support.",
          );
        }

        const verifyData = await verifyResponse.json();

        if (!verifyData.isPro) {
          throw new Error(
            "Payment verified but premium was not granted. Please contact support.",
          );
        }

        await finishPurchase(purchase);

        Alert.alert("Success", "Premium activated successfully!", [
          { text: "OK", onPress: () => router.replace("/profile") },
        ]);
      } catch (e) {
        console.error("PURCHASE LISTENER ERROR:", e);

        Alert.alert(
          "Purchase Error",
          e instanceof Error ? e.message : JSON.stringify(e, null, 2),
        );
      }
    });

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
  }, [router]);

  const handleUpgrade = async () => {
    setLoading(true);

    try {
      const plan = PRODUCTS.find((p) => p.id === selectedPlan);

      if (!plan) {
        throw new Error("Selected Premium plan is not available.");
      }

      let products = storeProducts;

      if (!products.length) {
        products = await (RNIap as any).fetchProducts({
          skus: SUBSCRIPTION_SKUS,
          type: "subs",
        });

        setStoreProducts(products || []);
      }

      console.log("SUBSCRIPTION PRODUCTS:", JSON.stringify(products, null, 2));

      const storeProduct = products.find(
        (item: any) => getStoreProductId(item) === plan.productId,
      );

      if (!storeProduct) {
        throw new Error(
          `Subscription product not found: ${plan.productId}. Please wait a few minutes and try again.`,
        );
      }

      console.log("Starting subscription purchase:", plan.productId);

      await (RNIap as any).requestPurchase({
        request: {
          apple: {
            sku: plan.productId,
          },
          google: {
            skus: [plan.productId],
            subscriptionOffers:
              storeProduct.subscriptionOfferDetailsAndroid?.map((offer: any) => ({
                sku: plan.productId,
                offerToken: offer.offerToken,
              })) || [],
          },
        },
        type: "subs",
      });
    } catch (error) {
      console.error("handleUpgrade FULL ERROR:", error);

      Alert.alert(
        "Upgrade Error",
        error instanceof Error
          ? error.message
          : JSON.stringify(error, null, 2),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoreLoading(true);

    try {
      const authToken = await getAuthToken();
      const guestId = authToken ? undefined : await getGuestId();

      const purchases = await RNIap.getAvailablePurchases();

      if (!purchases || purchases.length === 0) {
        Alert.alert(
          "Restore Purchases",
          "No previous purchases were found on this account.",
        );
        return;
      }

      const validPurchase = purchases.find((purchase: any) =>
        SUBSCRIPTION_SKUS.includes(purchase.productId || purchase.sku),
      );

      if (!validPurchase) {
        Alert.alert(
          "Restore Purchases",
          "No active Substracker Premium subscription was found.",
        );
        return;
      }

      const planId = getPurchasePlanId(validPurchase, currentPlanRef.current);

      const verifyResponse = await verifyPurchaseWithBackend(
        validPurchase,
        planId,
        authToken,
        guestId,
      );

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            "Restore failed. Please contact support if this continues.",
        );
      }

      const verifyData = await verifyResponse.json();

      if (!verifyData.isPro) {
        throw new Error(
          "Restore completed but premium was not granted. Please contact support.",
        );
      }

      await finishPurchase(validPurchase);

      Alert.alert("Success", "Premium restored successfully!", [
        { text: "OK", onPress: () => router.replace("/profile") },
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "There was a problem restoring your purchase. Please try again later.";

      Alert.alert("Restore error", message);
      console.error("Error restoring purchase", error);
    } finally {
      setRestoreLoading(false);
    }
  };

  const getDisplayedPrice = (plan: (typeof PRODUCTS)[number]) => {
    const storeProduct = storeProducts.find(
      (item: any) => getStoreProductId(item) === plan.productId,
    );

    return (
      storeProduct?.localizedPrice ||
      storeProduct?.displayPrice ||
      plan.price
    );
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

          {PRODUCTS.map((plan) => (
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
                    {getDisplayedPrice(plan)}
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
          loading={loading}
          style={styles.upgradeButton}
        />

        <Button
          title={restoreLoading ? "Restoring..." : "Restore Purchases"}
          variant="secondary"
          onPress={handleRestore}
          disabled={restoreLoading}
          loading={restoreLoading}
          style={styles.restoreButton}
        />

        <Text
          style={[
            styles.optionalText,
            { color: colors.text.muted, marginBottom: 16 },
          ]}
        >
          You can purchase Premium without creating an account. Signing in is
          optional and only needed if you want to sync purchases across devices.
        </Text>

        <View style={{ alignItems: "center" }}>
          <Text
            style={[
              styles.terms,
              { color: colors.text.muted, marginBottom: 8 },
            ]}
          >
            Subscriptions automatically renew unless cancelled at least 24 hours
            before the end of the current billing period.
          </Text>

          <TouchableOpacity
            onPress={() =>
              Linking.openURL("https://myzoapp.com/substracker/privacy-policy")
            }
          >
            <Text
              style={{
                color: colors.accent.primary,
                textDecorationLine: "underline",
              }}
            >
              Privacy Policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
              )
            }
          >
            <Text
              style={{
                color: colors.accent.primary,
                textDecorationLine: "underline",
                marginTop: 6,
              }}
            >
              Terms of Use
            </Text>
          </TouchableOpacity>
        </View>
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
  optionalText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginHorizontal: 4,
  },
  featureTitle: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  featureDescription: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  upgradeButton: { marginBottom: 16 },
  restoreButton: { marginBottom: 24 },
  terms: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});