import { Platform } from "react-native";
import {
  AppEventsLogger,
  Settings,
} from "react-native-fbsdk-next";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import * as Sentry from "@sentry/react-native";

/**
 * Thin wrapper around the Meta (Facebook) SDK App Events.
 *
 * Used for install / signup / purchase attribution so Meta ad campaigns can be
 * measured and optimised. All calls are no-ops if the SDK failed to initialise
 * so callers never need to guard.
 */

let initialised = false;

/**
 * Initialise the Meta SDK and resolve App Tracking Transparency on iOS.
 *
 * Call once, early in the app lifecycle. The native SDK is also auto-initialised
 * via the config plugin (`isAutoInitEnabled`), but we call `initializeSDK` here
 * to be explicit and to gate advertiser tracking on the user's ATT choice.
 */
export async function initMetaSdk(): Promise<void> {
  if (initialised) return;
  initialised = true;

  try {
    Settings.initializeSDK();

    // iOS 14.5+ requires explicit App Tracking Transparency consent before the
    // IDFA can be shared with Meta. On Android this resolves to "granted".
    if (Platform.OS === "ios") {
      const existing = await getTrackingPermissionsAsync();
      const status =
        existing.status === "undetermined"
          ? (await requestTrackingPermissionsAsync()).status
          : existing.status;

      await Settings.setAdvertiserTrackingEnabled(status === "granted");
    } else {
      await Settings.setAdvertiserTrackingEnabled(true);
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

/** Log an arbitrary custom App Event. */
export function logEvent(
  name: string,
  params?: Record<string, string | number>
): void {
  try {
    if (params) {
      AppEventsLogger.logEvent(name, params);
    } else {
      AppEventsLogger.logEvent(name);
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

/**
 * Completed registration (e.g. after a successful signup). Optionally tagged
 * with campaign params so Meta ad attribution reflects the originating link.
 */
export function logCompletedRegistration(
  method?: string,
  params?: Record<string, string | number>
): void {
  try {
    AppEventsLogger.logEvent("fb_mobile_complete_registration", {
      fb_registration_method: method ?? "unknown",
      ...params,
    });
  } catch (error) {
    Sentry.captureException(error);
  }
}

/** A purchase / payment. Amount is in the major currency unit (e.g. pounds). */
export function logPurchase(
  amount: number,
  currency = "GBP",
  params?: Record<string, string | number>
): void {
  try {
    AppEventsLogger.logPurchase(amount, currency, params);
  } catch (error) {
    Sentry.captureException(error);
  }
}
