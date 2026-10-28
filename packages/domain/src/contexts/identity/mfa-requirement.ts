/**
 * Requiring two-step sign-in for a whole organisation (Phase 33.12). An administrator sets the day from which everyone, staff and
 * outside partners alike, must have it on; until then people are reminded. From that day a person without it can do one thing only:
 * set it up. Pure: the clock is passed in. With single sign-on the identity provider owns two-step sign-in, so this rule is off.
 */
export type MfaGate = "NOT_REQUIRED" | "REQUIRED_SOON" | "SETUP_REQUIRED" | "DONE";

export const MFA_GRACE_CHOICES: readonly number[] = [0, 7, 14, 30];

export function mfaGate(input: { requiredFrom: Date | null | undefined; now: Date; userHasMfa: boolean; ssoManaged: boolean }): MfaGate {
  if (input.ssoManaged || !input.requiredFrom) return "NOT_REQUIRED";
  if (input.userHasMfa) return "DONE";
  return input.now.getTime() >= input.requiredFrom.getTime() ? "SETUP_REQUIRED" : "REQUIRED_SOON";
}

/** The day from which it is required, given a grace period in whole days (0 = from now). */
export function mfaRequiredFrom(now: Date, graceDays: number): Date {
  const days = MFA_GRACE_CHOICES.includes(graceDays) ? graceDays : 7;
  return new Date(now.getTime() + days * 86_400_000);
}

/**
 * What a person who must still set it up may reach: their own two-step routes, and nothing else. Anything else answers "set up
 * two-step sign-in first". (The setup routes themselves are the only way out of this state.)
 */
const SETUP_ALLOWED = [/^\/v1\/auth\/mfa(\/(setup|enable))?$/, /^\/v1\/auth\/logout$/];
export const isAllowedBeforeMfaSetup = (path: string): boolean => SETUP_ALLOWED.some((re) => re.test(path.split("?")[0] ?? path));

export const MFA_SETUP_REQUIRED_CODE = "MFA_SETUP_REQUIRED";
