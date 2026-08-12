export function isSafeRedirect(target: string | null | undefined): boolean {
  if (!target) return false;
  if (!target.startsWith("/")) return false;
  if (target.startsWith("//")) return false;
  return true;
}

export function safeRedirect(target: string | null | undefined, fallback = "/dashboard"): string {
  return isSafeRedirect(target) ? target! : fallback;
}
