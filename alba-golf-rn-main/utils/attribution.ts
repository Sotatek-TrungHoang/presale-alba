import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { postAttribution } from "@/api/attribution";

/**
 * In-house deep-link attribution capture.
 *
 * A free, self-hosted replacement for a paid attribution SDK (e.g. Branch) for
 * our use case: we don't need deferred deep linking, only to know which
 * campaign / link a session or signup originated from. Inbound link *routing*
 * is already handled by Expo Router + universal links; this module only records
 * the marketing params carried on those links so they can be attached to the
 * user at signup.
 *
 * All functions are best-effort and swallow errors (reporting to Sentry) so
 * callers never need to guard.
 */

const FIRST_TOUCH_KEY = "@alba/attribution/first_touch";
const LAST_TOUCH_KEY = "@alba/attribution/last_touch";

export interface Attribution {
  /** utm_source / equivalent (e.g. "instagram", "newsletter"). */
  source: string | null;
  /** utm_medium (e.g. "social", "email", "cpc"). */
  medium: string | null;
  /** utm_campaign (e.g. "summer_open_2026"). */
  campaign: string | null;
  /** utm_content (e.g. an ad / creative id). */
  content: string | null;
  /** utm_term (e.g. a paid keyword). */
  term: string | null;
  /** Generic referral token (?ref=...), e.g. an inviting user's id. */
  ref: string | null;
  /** The in-app path the link pointed at (e.g. "/round/123"). */
  path: string | null;
  /** The full inbound URL, kept for debugging / future parsing. */
  url: string;
  /** ISO timestamp of capture. */
  capturedAt: string;
}

let subscription: ReturnType<typeof Linking.addEventListener> | null = null;

/** Query params come back as string | string[] | undefined; take the first. */
const firstString = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

/** Pull the marketing params out of a URL, or null if it carries none. */
function parseAttribution(url: string): Attribution | null {
  const { path, queryParams } = Linking.parse(url);
  const q = queryParams ?? {};

  const attribution: Attribution = {
    source: firstString(q.utm_source),
    medium: firstString(q.utm_medium),
    campaign: firstString(q.utm_campaign),
    content: firstString(q.utm_content),
    term: firstString(q.utm_term),
    ref: firstString(q.ref),
    path: path ? `/${path}` : null,
    url,
    capturedAt: new Date().toISOString(),
  };

  // Ignore organic deep links (no marketing params) so they don't overwrite a
  // genuine campaign touch.
  const hasParams =
    attribution.source ||
    attribution.medium ||
    attribution.campaign ||
    attribution.content ||
    attribution.term ||
    attribution.ref;

  return hasParams ? attribution : null;
}

async function recordTouch(url: string | null): Promise<void> {
  if (!url) return;
  try {
    const attribution = parseAttribution(url);
    if (!attribution) return;

    // Last touch always wins.
    await AsyncStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(attribution));

    // First touch is set once and never overwritten.
    const existingFirst = await AsyncStorage.getItem(FIRST_TOUCH_KEY);
    if (!existingFirst) {
      await AsyncStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(attribution));
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

/**
 * Start capturing attribution from inbound links.
 *
 * Call once, early in the app lifecycle. Reads the URL that cold-started the
 * app and subscribes to links received while it is already running.
 */
export async function initAttribution(): Promise<void> {
  try {
    // Cold start: the link that launched the app, if any.
    const initialUrl = await Linking.getInitialURL();
    await recordTouch(initialUrl);

    // Warm: links received while the app is foregrounded / backgrounded.
    if (!subscription) {
      subscription = Linking.addEventListener("url", ({ url }) => {
        recordTouch(url);
      });
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

async function read(key: string): Promise<Attribution | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}

/** The first campaign / link that ever brought this install in (set once). */
export const getFirstTouch = () => read(FIRST_TOUCH_KEY);

/** The most recent campaign / link touch. */
export const getLastTouch = () => read(LAST_TOUCH_KEY);

/**
 * Flat, string-only campaign params for the most recent touch, suitable for
 * tagging analytics events (e.g. Meta App Events). Empty object if organic.
 */
export async function getCampaignParams(): Promise<Record<string, string>> {
  const touch = await getLastTouch();
  if (!touch) return {};

  const params: Record<string, string> = {};
  if (touch.source) params.utm_source = touch.source;
  if (touch.medium) params.utm_medium = touch.medium;
  if (touch.campaign) params.utm_campaign = touch.campaign;
  if (touch.content) params.utm_content = touch.content;
  if (touch.term) params.utm_term = touch.term;
  if (touch.ref) params.ref = touch.ref;
  return params;
}

/**
 * Send the captured attribution to the backend, tagged with how the user
 * registered. Fire-and-forget — call right after a successful signup.
 */
export async function reportSignupAttribution(method: string): Promise<void> {
  try {
    const [firstTouch, lastTouch] = await Promise.all([
      getFirstTouch(),
      getLastTouch(),
    ]);
    await postAttribution({ method, firstTouch, lastTouch });
  } catch (error) {
    Sentry.captureException(error);
  }
}
