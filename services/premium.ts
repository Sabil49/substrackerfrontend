import { functionsInstance } from "@/config/firebase";
import { getFriendlyErrorMessage } from "@/services/api";
import { httpsCallable } from "firebase/functions";
import { Platform } from "react-native";
import * as RNIap from "react-native-iap";

export const PREMIUM_PRODUCT_IDS = Platform.OS === 'android'
  ? ['com.substracker.monthly', 'com.substracker.yearly'] as const
  : [
  "com.substracker.premium.monthly",
  "com.substracker.premium.yearly",
] as const;

export type PremiumPlanId = "monthly" | "yearly";

const STORE_NAME = Platform.OS === "ios" ? "Apple ID" : "Google account";

export class NoPremiumFoundError extends Error {
  constructor() {
    super(
      `We couldn't find an active Premium subscription for this ${STORE_NAME}. ` +
        `If you subscribed with a different ${STORE_NAME}, switch to it in your device settings and try again.`,
    );
    this.name = "NoPremiumFoundError";
  }
}

// --- Store connection -------------------------------------------------------
// The store connection is shared by the paywall screen, "Restore Purchase" and
// the background entitlement sync. It is reference-counted so that one of them
// finishing never closes the connection another is still using (which used to
// break purchases and restores), and so every caller has a connection open
// before it talks to the store.
let connectionUsers = 0;
let connected = false;

// Open/close requests run strictly one after another, so a close can never
// overlap (and cancel) a connection that another caller is just opening.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function acquireIapConnection() {
  return serialize(async () => {
    if (!connected) {
      await RNIap.initConnection();
      connected = true;
    }
    connectionUsers += 1;
  });
}

export function releaseIapConnection() {
  return serialize(async () => {
    connectionUsers = Math.max(0, connectionUsers - 1);
    if (connectionUsers === 0 && connected) {
      connected = false;
      await RNIap.endConnection().catch(() => {});
    }
  });
}

// --- Store errors -----------------------------------------------------------
// The store reports errors with technical text (product ids, function names).
// Users only ever see these plain-language messages, chosen by error code.
const GENERIC_PURCHASE_MESSAGE = "We couldn't complete your purchase. Please try again.";

const PURCHASE_ERROR_MESSAGES: Record<string, string> = {
  "network-error": "We couldn't connect to the App Store. Check your internet connection and try again.",
  "service-error": "The App Store isn't available right now. Please try again in a moment.",
  "remote-error": "The App Store isn't available right now. Please try again in a moment.",
  "item-unavailable": "Premium isn't available to buy right now. Please try again later.",
  "sku-not-found": "Premium isn't available to buy right now. Please try again later.",
  "query-product": "Premium isn't available to buy right now. Please try again later.",
  "empty-sku-list": "Premium isn't available to buy right now. Please try again later.",
  "billing-unavailable": "Purchases aren't available on this device right now.",
  "iap-not-available": "Purchases aren't available on this device right now.",
  "feature-not-supported": "Purchases aren't available on this device right now.",
  "not-prepared": "We couldn't connect to the App Store. Please try again.",
  "init-connection": "We couldn't connect to the App Store. Please try again.",
  "connection-closed": "We couldn't connect to the App Store. Please try again.",
  "service-disconnected": "We couldn't connect to the App Store. Please try again.",
  "pending": "Your purchase is waiting for approval. Premium will unlock as soon as it's approved.",
  "deferred-payment": "Your purchase is waiting for approval. Premium will unlock as soon as it's approved.",
  "already-owned": "You're already subscribed. Tap Restore Purchase to unlock Premium.",
  "item-not-owned": "We couldn't find a Premium subscription on this account.",
};

export function getPurchaseErrorMessage(error: any): string {
  const code = String(error?.code ?? "");
  return PURCHASE_ERROR_MESSAGES[code] ?? GENERIC_PURCHASE_MESSAGE;
}

// The store re-sent a purchase it already delivered. Nothing for the user to do.
export function isDuplicatePurchaseError(error: any): boolean {
  return String(error?.code ?? "") === "duplicate-purchase";
}

// True when verification said the store record is an old, ended subscription
// rather than a new purchase.
export function isStaleTransactionError(error: any): boolean {
  return /expired|refunded|revoked/i.test(String(error?.message ?? ""));
}

// Clears transactions stuck in the App Store's queue (silent, no prompts).
export async function clearStuckTransactions() {
  if (Platform.OS !== "ios") return;
  try {
    await RNIap.clearTransactionIOS();
  } catch (error) {
    console.log("[premium] clearTransaction skipped:", error);
  }
}

// Clears stuck transactions and asks the App Store to refresh this device's
// purchase state. The refresh can show an Apple ID prompt, so it is only used
// when a purchase attempt needs recovering — never on the normal path.
export async function refreshStoreState() {
  if (Platform.OS !== "ios") return;
  await clearStuckTransactions();
  try {
    await RNIap.restorePurchases();
  } catch (error) {
    console.log("[premium] store sync skipped:", error);
  }
}

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
  const storeToken = getStoreToken(purchase);
  const failureText =
    mode === "restore"
      ? "We couldn't restore your purchase. Please try again."
      : "We couldn't confirm your purchase. Please try again.";

  if (!storeToken) {
    throw new Error(
      Platform.OS === "ios"
        ? "Apple didn't return the purchase details. Please try again."
        : "Google Play didn't return the purchase details. Please try again.",
    );
  }

  const callable = httpsCallable(
    functionsInstance,
    mode === "restore" ? "restorePremium" : "verifyPremiumPurchase",
  );

  try {
    const response = await callable({
      platform: Platform.OS === "ios" ? "ios" : "android",
      planId: getPremiumPlanId(purchase),
      ...(Platform.OS === "ios"
        ? { signedTransaction: storeToken }
        : { purchaseToken: storeToken }),
    });
    const result = response.data as any;
    if (!result?.isPro) throw new Error(failureText);
    return result;
  } catch (error: any) {
    console.warn(`[premium] ${mode} failed:`, error?.code, error?.message);
    // Keep the error code so callers can react to it (e.g. an expired
    // transaction), but only ever expose a plain-language message.
    throw Object.assign(new Error(getFriendlyErrorMessage(error, failureText)), {
      code: error?.code,
    });
  }
}

export function verifyPremiumPurchase(purchase: any) {
  return postStorePurchase(purchase, "verify");
}

// The store's "active subscriptions" records don't always carry the receipt
// token our server needs. When one is missing, take it from the matching
// purchase in the store's purchase list instead.
async function withStoreTokens(subscriptions: any[]) {
  if (subscriptions.every((subscription) => getStoreToken(subscription))) return subscriptions;

  let available: any[] = [];
  try {
    available = (await RNIap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })) as any[];
  } catch (error) {
    console.log("[premium] available purchases lookup skipped:", error);
  }

  return subscriptions.map(
    (subscription) =>
      (getStoreToken(subscription) ? subscription : undefined) ??
      available.find(
        (purchase) =>
          getPremiumProductId(purchase) === getPremiumProductId(subscription) && getStoreToken(purchase),
      ) ??
      subscription,
  );
}

export async function getActivePremiumSubscriptions() {
  const activeSubscriptions = await RNIap.getActiveSubscriptions([
    ...PREMIUM_PRODUCT_IDS,
  ]);

  return activeSubscriptions
    .filter(
      (subscription: any) =>
        subscription.isActive &&
        PREMIUM_PRODUCT_IDS.some(
          (productId) => productId === getPremiumProductId(subscription),
        ),
    )
    .sort((a: any, b: any) => {
      const aTime = a.expirationDateIOS || a.transactionDate || 0;
      const bTime = b.expirationDateIOS || b.transactionDate || 0;
      return bTime - aTime;
    });
}

// `syncWithStore` asks the App Store to refresh this device's purchases first.
// That can show an Apple ID prompt, so it is only used when the user taps
// "Restore Purchase" — never for the silent background sync.
export async function restorePremiumFromStore({
  syncWithStore = false,
}: { syncWithStore?: boolean } = {}) {
  await acquireIapConnection();
  try {
    if (syncWithStore) {
      try {
        await RNIap.restorePurchases();
      } catch (error) {
        console.log("[premium] store sync skipped:", error);
      }
    }

    const active = await getActivePremiumSubscriptions();
    if (!active.length) throw new NoPremiumFoundError();
    const subscriptions = await withStoreTokens(active);

    let lastError: unknown;
    for (const subscription of subscriptions) {
      try {
        return await postStorePurchase(subscription, "restore");
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new NoPremiumFoundError();
  } finally {
    await releaseIapConnection();
  }
}

export async function syncPremiumEntitlement() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;

  try {
    await restorePremiumFromStore();
    return true;
  } catch (error) {
    console.log("Premium entitlement sync skipped:", error);
    return false;
  }
}
