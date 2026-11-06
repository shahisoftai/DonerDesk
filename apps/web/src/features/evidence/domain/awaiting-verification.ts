/**
 * Which evidence "awaits verification" for the bulk action: a file nobody has decided on yet. A file with an open correction
 * request, a rejected one and an archived one are not: selecting them in bulk would verify a file past the reviewer's own request.
 */
const AWAITING = new Set(["UPLOADED", "AI_TAGGED", "PENDING_REVIEW"]);

export function isAwaitingVerification(status: string): boolean {
  return AWAITING.has(status);
}
