import type { SlideKey } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";
import { roleLabel } from "./team-view.ts";

/**
 * What a slide uses that the person already told the wizard on an earlier slide (Phase 59): shown as "From <slide>: value", so the same
 * fact is never asked twice and the person can see where it came from. A new carried fact is a row; nothing is copied or overwritten.
 */
export interface CarriedFact { key: string; from: SlideKey; value: string }

interface CarriedDef { slide: SlideKey; from: SlideKey; key: string; value(view: SetupDraftView): string | null }

const joined = (names: string[]): string | null => (names.length > 0 ? names.join(", ") : null);
const live = <T extends { status: string }>(items: readonly T[]): T[] => items.filter((i) => i.status !== "REJECTED");

export const CARRIED_FACTS: readonly CarriedDef[] = [
  { slide: "PLACES", from: "START", key: "country", value: (v) => v.extras.start.country?.trim() || null },
  { slide: "INDICATORS", from: "PROJECT_TEAM", key: "team", value: (v) => joined(v.extras.team.map((p) => `${p.name} (${roleLabel(p.role)})`)) },
  { slide: "WORK_PLAN", from: "PROJECT_TEAM", key: "team", value: (v) => joined(v.extras.team.map((p) => p.name)) },
  { slide: "WORK_PLAN", from: "PLACES", key: "places", value: (v) => joined(live(v.places).flatMap((p) => ((p.value as { name: string | null }).name ? [(p.value as { name: string }).name] : []))) },
  { slide: "WORK_PLAN", from: "PROJECT_TEAM", key: "dates", value: (v) => (v.facts.startDate && v.facts.endDate ? `${v.facts.startDate} → ${v.facts.endDate}` : null) },
  { slide: "FINANCE", from: "PROJECT_TEAM", key: "currency", value: (v) => v.facts.currency?.trim() || null },
];

/** The facts a slide reuses, only those the person has actually given. */
export function carriedFacts(view: SetupDraftView, slide: SlideKey): CarriedFact[] {
  return CARRIED_FACTS.filter((d) => d.slide === slide).flatMap((d) => {
    const value = d.value(view);
    return value ? [{ key: d.key, from: d.from, value }] : [];
  });
}
