import { Platform } from "react-native";
import * as RNIap from "react-native-iap";
import { API_URL } from "./api";
import { getAuthToken, getGuestId } from "@/utils/storage";

export const PREMIUM_PRODUCT_IDS = [
  "com.substracker.premium.monthly",
  "com.substracker.premium.yearly",
] as const;

export type PremiumPlanId = "monthly" | "yearly";

export function getPremiumProductId(purchase: any): string | undefined {
  return purchase?.productId || purchase?.sku || purchase?.currentPlanId;
}

export function getPremiumPlanId(purchase: any): PremiumPlanId {
  return getPremiumProductId(purchase) === PREMIUM_PRODUCT_IDS[0]
    ? "monthly"
    : "yearly";
}

function getStoreToken(purchase: any) {
  return purchase?.purchaseToken || purchase?.purchaseTokenAndroid;
}

async function postStorePurchase(
  purchase: any,
  mode: "verify" | "restore",
) {
  const authToken = await getAuthToken();
  const guestId = authToken ? undefined : await getGuestId();
  const storeToken = getStoreToken(purchase);

  if (!storeToken) {
    throw new Error(
      Platform.OS === "ios"
        ? "Apple did not return a signed transaction."
        : "Google Play did not return a purchase token.",
    );
  }

  const response = await fetch(
    `${API_URL}/api/user/${
      mode === "restore" ? "restore-premium" : "verify-premium-purchase"
    }`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        platform: Platform.OS === "ios" ? "ios" : "android",
        planId: getPremiumPlanId(purchase),
        ...(Platform.OS === "ios"
          ? { signedTransaction: storeToken }
          : { purchaseToken: storeToken }),
        ...(guestId ? { guestId } : {}),
      }),
    },
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.isPro) {
    throw new Error(
      result.error ||
        result.message ||
        `${mode === "restore" ? "Restore" : "Purchase verification"} failed.`,
    );
  }
  return result;
}

export function verifyPremiumPurchase(purchase: any) {
  return postStorePurchase(purchase, "verify");
}

export async function getActivePremiumSubscriptions() {
  const activeSubscriptions = await RNIap.getActiveSubscriptions([
    ...PREMIUM_PRODUCT_IDS,
  ]);

  return activeSubscriptions
    .filter(
      (subscription: any) =>
        subscription.isActive &&
        PREMIUM_PRODUCT_IDS.includes(
          getPremiumProductId(subscription) as (typeof PREMIUM_PRODUCT_IDS)[number],
        ),
    )
    .sort((a: any, b: any) => {
      const aTime = a.expirationDateIOS || a.transactionDate || 0;
      const bTime = b.expirationDateIOS || b.transactionDate || 0;
      return bTime - aTime;
    });
}

export async function restorePremiumFromStore() {
  const subscriptions = await getActivePremiumSubscriptions();
  if (!subscriptions.length) {
    throw new Error("No active SubTracker Premium subscription was found.");
  }

  let lastError: unknown;
  for (const subscription of subscriptions) {
    try {
      return await postStorePurchase(subscription, "restore");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No restorable Premium subscription was found.");
}

export async function syncPremiumEntitlement() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;

  let connected = false;
  try {
    await RNIap.initConnection();
    connected = true;
    await restorePremiumFromStore();
    return true;
  } catch (error) {
    console.log("Premium entitlement sync skipped:", error);
    return false;
  } finally {
    if (connected) await RNIap.endConnection().catch(() => {});
  }
}
