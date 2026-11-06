/**
 * The last look before launch (Phase 38.9): what the draft holds in plain counts, and the sign-off that goes with exactly
 * that content. A sign-off records who signed, when, and a fingerprint of the draft at that moment; any later change makes it
 * stale, so nobody launches something different from what was signed. The fingerprint is a plain string hash (it only has to
 * notice a change; the server also re-checks every requirement on launch). Pure.
 */
import type { Proposed, RiskDef } from "../proposal.js";
import type { SetupDraft } from "./draft.js";
import { isLive } from "./requirements/shared.js";

export interface LaunchSummary {
  results: number;
  indicators: number;
  places: number;
  plannedActivities: number;
  budgetLines: number;
  fundingSources: number;
  risks: number;
  assumptions: number;
  people: number;
  /** People who get an invitation when the project starts. */
  invitedAtLaunch: number;
  /** People named but invited later. */
  invitedLater: number;
  /** Items read from the project's documents that were accepted, and ones left out. */
  fromDocuments: { accepted: number; leftOut: number };
}

export function launchSummary(draft: SetupDraft): LaunchSummary {
  const p = draft.proposal;
  const live = (items: ReadonlyArray<Proposed<unknown>>) => items.filter(isLive);
  const docs = ([...p.logframe, ...p.indicators, ...p.plan, ...p.places, ...p.funding, ...p.budget, ...p.risks] as Array<Proposed<unknown>>).filter((i) => i.sourceQuote !== null);
  const risks = live(p.risks) as Array<Proposed<RiskDef>>;
  const team = draft.extras.team;
  return {
    results: live(p.logframe).length,
    indicators: live(p.indicators).length,
    places: live(p.places).length,
    plannedActivities: live(p.plan).length,
    budgetLines: live(p.budget).length,
    fundingSources: live(p.funding).length,
    risks: risks.filter((r) => r.value?.kind !== "ASSUMPTION").length,
    assumptions: risks.filter((r) => r.value?.kind === "ASSUMPTION").length,
    people: team.length,
    invitedAtLaunch: team.filter((t) => t.invite === "NOW").length,
    invitedLater: team.filter((t) => t.invite === "LATER").length,
    fromDocuments: { accepted: docs.filter(isLive).length, leftOut: docs.filter((i) => !isLive(i)).length },
  };
}

/** Objects with their keys in a fixed order, so the same content always gives the same string. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable((value as Record<string, unknown>)[k])]));
  return value;
}

/** 53-bit string hash (cyrb53): small, fast, and enough to notice a change. */
function hash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/** A fingerprint of everything signed off: the proposal and every decision except the sign-off itself. */
export function draftFingerprint(draft: SetupDraft): string {
  const { signOff: _signOff, ...extras } = draft.extras;
  void _signOff;
  return hash(JSON.stringify(stable({ proposal: draft.proposal, extras })));
}

export type SignOffResult = { ok: true; draft: SetupDraft } | { ok: false; reason: string };

/** Records who signed and what they signed. Refused while anything is still open: a person signs off a finished draft. */
export function signOffDraft(draft: SetupDraft, userId: string, at: string, openCount: number): SignOffResult {
  if (openCount > 0) return { ok: false, reason: `${openCount} thing${openCount > 1 ? "s are" : " is"} still to answer. Finish those, then sign off.` };
  return { ok: true, draft: { ...draft, extras: { ...draft.extras, signOff: { byUserId: userId, at, fingerprint: draftFingerprint(draft) } } } };
}

/** Whether the sign-off on the draft is for exactly what the draft holds now. */
export function signOffIsCurrent(draft: SetupDraft): boolean {
  const s = draft.extras.signOff;
  return Boolean(s.byUserId && s.fingerprint && s.fingerprint === draftFingerprint(draft));
}
