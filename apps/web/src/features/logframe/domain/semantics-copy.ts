/**
 * The sentence under "How this value is calculated". It reads the same signal as the badge beside it (the server's
 * `needsReview`), so the two can never disagree: a count that needs no review is not "not confirmed yet".
 */
export function semanticsIntro(input: { configured: boolean; needsReview?: boolean }): string {
  const confirmed = input.needsReview === undefined ? input.configured : !input.needsReview;
  return confirmed
    ? "Confirmed. Reports treat this indicator according to the settings below."
    : "Not confirmed yet. Reports use the suggestion below and only describe this indicator — they will not say whether it is on track.";
}
