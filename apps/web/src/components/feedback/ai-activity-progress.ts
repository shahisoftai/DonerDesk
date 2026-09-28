/**
 * Approaches (but never reaches) 92% over `estimatedMs`, using an ease-out
 * curve (fast at first, slower as it goes) — used when there is no real
 * progress signal (e.g. template extraction), so the bar keeps moving
 * instead of sitting still for a minute or more. The caller snaps it to
 * 100% by closing the popup once the real operation finishes.
 */
export function simulatedPercent(elapsedMs: number, estimatedMs: number): number {
  const CAP = 92;
  return CAP * (1 - Math.exp(-elapsedMs / estimatedMs));
}
