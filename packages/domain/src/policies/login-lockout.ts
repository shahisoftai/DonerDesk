/**
 * Sign-in throttling for tenant users. Five wrong passwords in a row lock the account for fifteen minutes; a correct
 * password, a completed reset or the lock expiring clears the count. Stored on the user (not in memory) so it holds
 * across restarts and instances. The cost is that someone who knows an address can lock that account out for a while,
 * which is the usual trade against unlimited guessing.
 */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export function lockoutUntil(now: Date): Date {
  return new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
}

/** Whole minutes (at least one) until a lock ends. */
export function minutesUntil(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}
