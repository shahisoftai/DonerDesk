/**
 * Pinned tiles on a person's Home (Phase 35.H4): a person's own shortcuts to something they can open, drawn on their Home. A pin stores which thing, never what it shows;
 * a pin whose target was deleted or is no longer visible is shown as such, never hidden silently.
 */
export const MAX_HOME_PINS = 12;
export const HOME_PIN_KINDS = ["DASHBOARD"] as const;
export type HomePinKind = (typeof HOME_PIN_KINDS)[number];

export type HomePinProblemCode = "KIND_UNKNOWN" | "REF_EMPTY" | "ALREADY_PINNED" | "TOO_MANY";
export interface HomePinProblem { code: HomePinProblemCode; message: string }

export function checkHomePin(input: { kind: string; ref: string }, existing: ReadonlyArray<{ kind: string; ref: string }>): { ok: true; value: { kind: HomePinKind; ref: string } } | { ok: false; problem: HomePinProblem } {
  const no = (code: HomePinProblemCode, message: string) => ({ ok: false as const, problem: { code, message } });
  if (!(HOME_PIN_KINDS as readonly string[]).includes(input.kind)) return no("KIND_UNKNOWN", "That cannot be pinned to Home.");
  const ref = input.ref.trim();
  if (ref === "" || ref.length > 64) return no("REF_EMPTY", "Choose what to pin.");
  if (existing.some((p) => p.kind === input.kind && p.ref === ref)) return no("ALREADY_PINNED", "That is already pinned to your Home.");
  if (existing.length >= MAX_HOME_PINS) return no("TOO_MANY", `You can pin ${MAX_HOME_PINS} things to Home. Remove one first.`);
  return { ok: true, value: { kind: input.kind as HomePinKind, ref } };
}

/** The order after moving one pin to a new place; an unknown id leaves the order as it was. */
export function reorderPins(ids: ReadonlyArray<string>, id: string, to: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const next = ids.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}
