// app/premium.tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage, userApi } from "@/services/api";
import {
  PREMIUM_PRODUCT_IDS,
  restorePremiumFromStore,
  verifyPremiumPurchase,
} from "@/services/premium";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

const SUBSCRIPTION_SKUS = [...PREMIUM_PRODUCT_IDS];

const FEATURES = [
  {
    title: "Unlimited Subscriptions",
    description: "Track every recurring charge without the free-plan limit",
  },
  {
    title: "Smart Renewal Reminders",
    description: "Get alerts 7 days, 3 days, 1 day, and on renewal day",
  },
  {
    title: "Trial Ending Alerts",
    description: "Protect free trials before they quietly become paid",
  },
  {
    title: "Renewal Calendar",
    description: "See what is charging next and plan your month",
  },
  {
    title: "Receipt Import",
    description: "Find subscriptions from screenshots or receipts without bank linking",
  },
  {
    title: "Savings Tracker",
    description: "Spot subscriptions to cancel and track money saved",
  },
  {
    title: "Cancellation Help",
    description: "Open the right store page and mark cancellations cleanly",
  },
];

const PRODUCTS = [
  {
    id: "monthly",
    name: "Monthly",
    productId: PREMIUM_PRODUCT_IDS[0],
    price: "$4.99",
    period: "/month",
    popular: false,
  },
  {
    id: "yearly",
    name: "Yearly",
    productId: PREMIUM_PRODUCT_IDS[1],
    price: "$39.99",
    period: "/year",
    popular: true,
    savings: "Save 33%",
  },
];

type PlanId = (typeof PRODUCTS)[number]["id"];

const getStoreProductId = (item: any) =>
  item?.id || item?.productId || item?.sku || item?.productIdAndroid;


const isAlreadyOwnedError = (error: any) => {
  const code = String(error?.code || error?.responseCode || "").toLowerCase();
  const message = String(error?.message || error?.debugMessage || "").toLowerCase();
  return (
    code.includes("already") ||
    code.includes("owned") ||
    message.includes("already owned") ||
    message.includes("item is already owned") ||
    message.includes("you are currently subscribed")
  );
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
  const [isPremium, setIsPremium] = useState(false);

  const handleRestore = useCallback(async () => {
    setRestoreLoading(true);

    try {
      await restorePremiumFromStore();
      setIsPremium(true);

      Alert.alert("Success", "Premium restored successfully!", [
        { text: "OK", onPress: () => router.replace("/(tabs)/account") },
      ]);
    } catch (error) {
      Alert.alert(
        "Restore Error",
        getFriendlyErrorMessage(
          error,
          "There was a problem restoring your purchase. Please try again later.",
        ),
      );
      console.error("Error restoring purchase", error);
    } finally {
      setRestoreLoading(false);
    }
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      userApi
        .get()
        .then((user) => active && setIsPremium(user.isPro))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

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

      try {
        await verifyPremiumPurchase(purchase);

        await finishPurchase(purchase);
        setIsPremium(true);

        Alert.alert("Success", "Premium activated successfully!", [
          { text: "OK", onPress: () => router.replace("/(tabs)/account") },
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

      if (isAlreadyOwnedError(error)) {
        Alert.alert(
          "Premium Already Owned",
          "Apple says this subscription is already owned. Restore your purchase to unlock Premium on this Substracker profile.",
          [
            { text: "Not Now", style: "cancel" },
            { text: "Restore", onPress: handleRestore },
          ],
        );
        return;
      }

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
  }, [router, handleRestore]);

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

      Alert.alert("Upgrade Error", getFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
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
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      <LinearGradient
        colors={colors.gradient.pageGlow as readonly [string, string, ...string[]]}
        style={styles.pageGlow}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeButton, { backgroundColor: "rgba(255,255,255,0.08)" }]}
        >
          <Ionicons name="close" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <LinearGradient
          colors={
            colors.gradient.guard as readonly [string, string, ...string[]]
          }
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="sparkles" size={34} color="#fff" style={styles.heroIcon} />
          <Text style={styles.heroTitle}>
            {isPremium ? "Premium is Active" : "Upgrade to Premium"}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isPremium
              ? "Unlimited subscriptions, reminders, calendar, and savings tools are unlocked"
              : "Find forgotten subscriptions and stop surprise renewals without linking your bank"}
          </Text>
        </LinearGradient>

        {!isPremium && <View style={styles.plansSection}>
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
        </View>}

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
              <View style={[styles.featureCheck, { backgroundColor: "rgba(168,85,247,0.18)" }]}>
                <Ionicons name="checkmark" size={14} color="#A855F7" />
              </View>

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

        {!isPremium && (
          <Button
            title={loading ? "Processing..." : "Continue"}
            onPress={handleUpgrade}
            disabled={loading || restoreLoading}
            loading={loading}
            style={styles.upgradeButton}
          />
        )}

        <Button
          title={restoreLoading ? "Restoring..." : "Restore Purchases"}
          variant="secondary"
          onPress={handleRestore}
          disabled={restoreLoading || loading}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 480 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    borderRadius: 28,
    padding: 36,
    alignItems: "center",
    marginBottom: 28,
  },
  heroIcon: { marginBottom: 16 },
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
  featureCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  featureTitle: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  featureDescription: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  upgradeButton: { marginBottom: 16 },
  restoreButton: { marginBottom: 24 },
  terms: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});








