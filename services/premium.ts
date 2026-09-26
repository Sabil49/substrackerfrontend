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

    const subscriptions = await getActivePremiumSubscriptions();
    if (!subscriptions.length) throw new NoPremiumFoundError();

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
