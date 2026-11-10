/**
 * Movements between places (Phase 48.12): what moved from one place of the organisation's list to another, and how much, as the project
 * recorded it (people displaced, supplies sent, referrals made). A flow names two different live places, says what moves in a few
 * words, and has a quantity above zero in one unit; nothing here is derived or guessed, and a quantity is never zero or negative.
 */
export const FLOW_LIMITS = { what: 60, unit: 24, note: 200, perProject: 500, maxQuantity: 1e12 } as const;

export interface PlaceFlowInput { fromPlaceId: string; toPlaceId: string; what: string; quantity: number; unit: string; note?: string | undefined }
export type PlaceFlowCheck = { ok: true; value: PlaceFlowInput } | { ok: false; problem: string };

/** The one check behind adding a flow: the two places must be live places of the list, different from each other. */
export function checkPlaceFlow(input: PlaceFlowInput, livePlaceIds: ReadonlySet<string>, existingForProject: number): PlaceFlowCheck {
  const what = input.what.trim();
  const unit = input.unit.trim();
  const note = input.note?.trim();
  if (existingForProject >= FLOW_LIMITS.perProject) return { ok: false, problem: `A project keeps at most ${FLOW_LIMITS.perProject} movements. Remove some to add more.` };
  if (!livePlaceIds.has(input.fromPlaceId)) return { ok: false, problem: "Choose the place it moves from, from the places list." };
  if (!livePlaceIds.has(input.toPlaceId)) return { ok: false, problem: "Choose the place it moves to, from the places list." };
  if (input.fromPlaceId === input.toPlaceId) return { ok: false, problem: "A movement goes from one place to a different one." };
  if (what.length === 0) return { ok: false, problem: "Say in a few words what moves (for example people, tents, referrals)." };
  if (what.length > FLOW_LIMITS.what) return { ok: false, problem: `Keep what moves under ${FLOW_LIMITS.what} characters.` };
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return { ok: false, problem: "The quantity is a number above zero." };
  if (input.quantity > FLOW_LIMITS.maxQuantity) return { ok: false, problem: "That quantity is too large to be right." };
  if (unit.length > FLOW_LIMITS.unit) return { ok: false, problem: `Keep the unit under ${FLOW_LIMITS.unit} characters.` };
  if ((note?.length ?? 0) > FLOW_LIMITS.note) return { ok: false, problem: `Keep the note under ${FLOW_LIMITS.note} characters.` };
  return { ok: true, value: { fromPlaceId: input.fromPlaceId, toPlaceId: input.toPlaceId, what, quantity: input.quantity, unit, ...(note ? { note } : {}) } };
}
