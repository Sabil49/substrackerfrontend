// app/premium.tsx
import Button from "@/components/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { getFriendlyErrorMessage, isUserCancelledError, userApi } from "@/services/api";
import {
  acquireIapConnection,
  clearStuckTransactions,
  getPremiumProductId,
  getPurchaseErrorMessage,
  isDuplicatePurchaseError,
  isStaleTransactionError,
  NoPremiumFoundError,
  PREMIUM_PRODUCT_IDS,
  refreshStoreState,
  releaseIapConnection,
  restorePremiumFromStore,
  verifyPremiumPurchase,
} from "@/services/premium";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

// Only things that genuinely need Premium (everything else is free).
const FEATURES = [
  {
    title: "Unlimited subscriptions",
    description: "The free plan tracks up to 5 — Premium has no limit",
  },
  {
    title: "Spending statistics",
    description: "Monthly and yearly totals, categories, and upcoming charges",
  },
  {
    title: "Receipt scanner",
    description: "Add a subscription from a screenshot or photo of a receipt",
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

type PurchaseAttempt = {
  eventSeen: boolean;
  succeeded: boolean;
  cancelled: boolean;
  sawStale: boolean;
  alreadyOwned: boolean;
  failure: string | null;
};

const freshAttempt = (): PurchaseAttempt => ({
  eventSeen: false,
  succeeded: false,
  cancelled: false,
  sawStale: false,
  alreadyOwned: false,
  failure: null,
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function PremiumScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>("yearly");
  const [loading, setLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  // What happened to the purchase the user just started. Refs, so the store's
  // listeners and the purchase routine always see the same live values.
  const attempt = useRef<PurchaseAttempt>(freshAttempt());
  const isPremiumRef = useRef(false);
  const celebrated = useRef(false);
  const lastAlertAt = useRef(0);

  // The store can report one failure more than one way; show only the first alert.
  const alertOnce = useCallback(
    (title: string, message: string, buttons?: Parameters<typeof Alert.alert>[2]) => {
      if (Date.now() - lastAlertAt.current < 2000) return;
      lastAlertAt.current = Date.now();
      Alert.alert(title, message, buttons);
    },
    [],
  );

  const markPremium = useCallback((value: boolean) => {
    isPremiumRef.current = value;
    setIsPremium(value);
  }, []);

  // Read through a ref so the store listeners below are registered once and
  // never torn down mid-purchase just because the router object changed.
  const routerRef = useRef(router);
  routerRef.current = router;

  const celebrate = useCallback(
    (title: string, message: string) => {
      if (celebrated.current) return;
      celebrated.current = true;
      markPremium(true);
      Alert.alert(title, message, [
        { text: "OK", onPress: () => routerRef.current.replace("/(tabs)/account") },
      ]);
    },
    [markPremium],
  );

  const handleRestore = useCallback(async () => {
    setRestoreLoading(true);

    try {
      await restorePremiumFromStore({ syncWithStore: true });
      celebrate("Premium Restored", "Your Premium subscription is active again.");
    } catch (error) {
      console.error("Error restoring purchase", error);
      alertOnce(
        "Couldn't Restore Purchase",
        getFriendlyErrorMessage(error, "We couldn't restore your purchase. Please try again later."),
      );
    } finally {
      setRestoreLoading(false);
    }
  }, [alertOnce, celebrate]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      userApi
        .get()
        .then((user) => active && markPremium(user.isPro))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [markPremium]),
  );

  useEffect(() => {
    let active = true;
    let acquired = false;

    const initIAP = async () => {
      try {
        await acquireIapConnection();
        if (!active) {
          // The screen closed while we were connecting — give it back.
          await releaseIapConnection();
          return;
        }
        acquired = true;

        const products = await (RNIap as any).fetchProducts({
          skus: SUBSCRIPTION_SKUS,
          type: "subs",
        });

        if (active) setStoreProducts(products || []);
      } catch (err) {
        console.error("RNIap init/products failed", err);
      }
    };

    initIAP();

    // A purchase arrived from the store — check it with our server.
    const purchaseUpdateSub = RNIap.purchaseUpdatedListener(async (purchase) => {
      // Ignore anything that isn't one of our Premium plans.
      const productId = getPremiumProductId(purchase);
      if (!productId || !SUBSCRIPTION_SKUS.some((sku) => sku === productId)) return;

      attempt.current.eventSeen = true;
      try {
        await verifyPremiumPurchase(purchase);
        await finishPurchase(purchase);
        attempt.current.succeeded = true;
        celebrate("Welcome to Premium", "Your subscription is active. Enjoy!");
      } catch (e: any) {
        console.warn("Purchase verification failed:", e?.code, e?.message);
        if (isStaleTransactionError(e)) {
          // An old, ended subscription the store re-sent — not the user's new
          // purchase. Clear it and carry on; nothing to tell the user.
          attempt.current.sawStale = true;
          await finishPurchase(purchase);
          return;
        }
        // Leave the transaction unfinished so it is retried next time.
        attempt.current.failure = getFriendlyErrorMessage(
          e,
          "We couldn't confirm your purchase. Please try again.",
        );
      }
    });

    const purchaseErrorSub = RNIap.purchaseErrorListener((error) => {
      console.warn("IAP purchase error", error?.code);
      attempt.current.eventSeen = true;

      if (isUserCancelledError(error)) {
        attempt.current.cancelled = true; // closing the payment sheet isn't an error
      } else if (isDuplicatePurchaseError(error)) {
        attempt.current.sawStale = true; // same record delivered twice
      } else if (isAlreadyOwnedError(error)) {
        attempt.current.alreadyOwned = true;
      } else {
        attempt.current.failure = getPurchaseErrorMessage(error);
      }
    });

    return () => {
      active = false;
      purchaseUpdateSub.remove();
      purchaseErrorSub.remove();
      if (acquired) releaseIapConnection();
    };
  }, [celebrate]);

  // Waits for the store's listeners to report how the purchase ended.
  const waitForOutcome = async (timeoutMs: number) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const a = attempt.current;
      if (a.succeeded || a.cancelled || a.failure || a.alreadyOwned) return;
      // Only an old record came back: don't wait long for a real one.
      if (a.sawStale && Date.now() - started > 1500) return;
      // The store reported nothing at all (e.g. the payment sheet was dismissed).
      if (!a.eventSeen && Date.now() - started > 5000) return;
      await sleep(250);
    }
  };

  const startPurchase = async (plan: (typeof PRODUCTS)[number], storeProduct: any) => {
    attempt.current = freshAttempt();

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

    await waitForOutcome(20000);
  };

  const handleUpgrade = async () => {
    if (loading) return;
    setLoading(true);
    celebrated.current = false;

    try {
      const plan = PRODUCTS.find((p) => p.id === selectedPlan);
      if (!plan) throw new Error("That plan isn't available right now.");

      await acquireIapConnection();
      try {
        let products = storeProducts;
        if (!products.length) {
          products = await (RNIap as any).fetchProducts({
            skus: SUBSCRIPTION_SKUS,
            type: "subs",
          });
          setStoreProducts(products || []);
        }

        const storeProduct = products.find(
          (item: any) => getStoreProductId(item) === plan.productId,
        );
        if (!storeProduct) {
          throw new Error(
            "Premium plans couldn't be loaded from the App Store. Please try again in a few minutes.",
          );
        }

        // 1. Already subscribed (earlier, or on another device)? Then unlock it
        //    instead of asking the user to pay twice.
        try {
          await restorePremiumFromStore();
          celebrate("Premium Is Active", "Your subscription is already active on this account.");
          return;
        } catch (error: any) {
          if (error?.code === "functions/already-exists") {
            alertOnce("Subscription Linked to Another Account", getFriendlyErrorMessage(error));
            return;
          }
          // Not subscribed yet (or the check failed) — go on to the purchase.
        }

        // 2. Buy. First clear anything stuck in the store's queue.
        await clearStuckTransactions();
        await startPurchase(plan, storeProduct);

        // The store handed back an old, ended subscription instead of a payment
        // sheet. Refresh its state and try once more.
        let a = attempt.current;
        if (!a.succeeded && !a.cancelled && !a.failure && a.sawStale) {
          await refreshStoreState();
          await startPurchase(plan, storeProduct);
          a = attempt.current;
        }

        if (a.succeeded || a.cancelled) return;

        // 3. Last check: maybe the purchase did go through and only the
        //    confirmation was missed.
        try {
          await restorePremiumFromStore();
          celebrate("Welcome to Premium", "Your subscription is active. Enjoy!");
          return;
        } catch {
          // fall through to the message below
        }

        // The store reported nothing — the payment sheet was simply closed.
        if (!a.eventSeen) return;

        if (a.failure) {
          alertOnce("Purchase Not Completed", a.failure);
        } else if (a.alreadyOwned) {
          alertOnce(
            "You're Already Subscribed",
            "This Apple ID already has Premium. Tap Restore Purchase to unlock it here.",
            [
              { text: "Not Now", style: "cancel" },
              { text: "Restore", onPress: handleRestore },
            ],
          );
        } else if (a.sawStale) {
          alertOnce(
            "Couldn't Start Your Subscription",
            "Your Apple account still shows a previous subscription that has ended, so a new payment couldn't start. Please wait a minute and try again, or tap Restore Purchase.",
          );
        } else {
          alertOnce(
            "Purchase Not Completed",
            "We couldn't complete your purchase. If you were charged, tap Restore Purchase to unlock Premium.",
          );
        }
      } finally {
        await releaseIapConnection();
      }
    } catch (error: any) {
      console.error("handleUpgrade error:", error?.code, error?.message);
      if (!isUserCancelledError(error)) {
        alertOnce(
          "Couldn't Start Purchase",
          error instanceof NoPremiumFoundError || !error?.code
            ? getFriendlyErrorMessage(error, "We couldn't start the purchase. Please try again.")
            : getPurchaseErrorMessage(error),
        );
      }
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
        <View style={styles.hero}>
          <View style={[styles.heroIconWrap, { backgroundColor: colors.badge.worthItBg }]}>
            <Ionicons name="sparkles" size={28} color={colors.accent.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
            {isPremium ? "Premium is Active" : "Upgrade to Premium"}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
            {isPremium
              ? "Unlimited subscriptions, reminders, calendar, and savings tools are unlocked."
              : "Find forgotten subscriptions and stop surprise renewals without linking your bank."}
          </Text>
        </View>

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
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={[styles.featureCheck, { backgroundColor: colors.badge.worthItBg }]}>
                <Ionicons name="checkmark" size={13} color={colors.accent.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: colors.text.primary }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.text.secondary }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {!isPremium && (
          <Button
            title={loading ? "Processing..." : "Get Premium"}
            onPress={handleUpgrade}
            disabled={loading || restoreLoading}
            loading={loading}
            style={styles.upgradeButton}
          />
        )}

        <TouchableOpacity onPress={handleRestore} disabled={restoreLoading || loading} style={styles.restoreLink}>
          <Text style={[styles.restoreLinkText, { color: colors.accent.primary }]}>
            {restoreLoading ? "Restoring..." : "Restore Purchase"}
          </Text>
        </TouchableOpacity>

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
  hero: { alignItems: "center", marginBottom: 28 },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
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
  featuresSection: { marginBottom: 8 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 14,
  },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  featureTitle: { fontSize: 15, fontWeight: "700" },
  featureDescription: { fontSize: 13, fontWeight: "500", marginTop: 2, lineHeight: 18 },
  upgradeButton: { marginTop: 8, marginBottom: 16 },
  restoreLink: { alignItems: "center", paddingVertical: 6, marginBottom: 24 },
  restoreLinkText: { fontSize: 14, fontWeight: "700" },
  terms: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});








