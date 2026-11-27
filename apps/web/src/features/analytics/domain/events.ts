/** The events the site sends. Names are Google's recommended ones, so they show up in its standard reports. */
export const ANALYTICS_EVENTS = {
  signUp: "sign_up",
  beginTrial: "begin_trial",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
export type AnalyticsParams = Readonly<Record<string, string>>;

/** The page the account lands on after sign-up, named by a word rather than an address (no address is ever taken from a link). */
export const WELCOME_DESTINATIONS = ["onboarding", "checkout"] as const;
export type WelcomeDestination = (typeof WELCOME_DESTINATIONS)[number];
export const WELCOME_PLANS = ["starter", "team", "growth"] as const;
export type WelcomePlan = (typeof WELCOME_PLANS)[number];

export interface WelcomeInput {
  kind?: string;
  to?: string;
  plan?: string;
}

export interface Welcome {
  event: AnalyticsEventName;
  params: AnalyticsParams;
  /** Where to send the person next: always one of the app's own two pages. */
  next: string;
}

function oneOf<T extends string>(list: readonly T[], value: string | undefined): T | null {
  return list.find((item) => item === value) ?? null;
}

/**
 * What the sign-up relay does with the words in its address. Unknown words fall back to a plain sign-up that goes to
 * onboarding, so a crafted link can neither send a person elsewhere nor put free text into an analytics event.
 */
export function resolveWelcome(input: WelcomeInput): Welcome {
  const plan = oneOf(WELCOME_PLANS, input.plan) ?? "starter";
  const to = oneOf(WELCOME_DESTINATIONS, input.to) ?? "onboarding";
  const trial = input.kind === "trial";
  return {
    event: trial ? ANALYTICS_EVENTS.beginTrial : ANALYTICS_EVENTS.signUp,
    params: trial ? { plan } : { method: "email", plan },
    next: to === "checkout" && plan !== "starter" ? `/checkout?plan=${plan}` : "/onboarding",
  };
}

/** The address signup sends a new account to; the relay turns it into an event and forwards. */
export function welcomeAddress(kind: "signup" | "trial", to: WelcomeDestination, plan: WelcomePlan): string {
  return `/welcome?kind=${kind}&to=${to}&plan=${plan}`;
}
