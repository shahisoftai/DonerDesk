/**
 * Link suggesters for the work plan (Phase 38.5): each reads the draft and offers links a person may accept — an activity's
 * indicators, its places and its lead. Every suggestion carries the reason it is offered and nothing is applied until the
 * person accepts. A suggester never offers a link that already exists or that the person rejected, never reaches outside the
 * draft, and is deterministic. A new suggester is a row in `SETUP_LINK_SUGGESTERS`.
 */
import { normalizeLocationKey } from "../../../workplan/location-key.js";
import type { SetupDraft } from "../draft.js";
import { planKeyOf } from "../draft.js";
import { live } from "../requirements/shared.js";

export type SetupLinkKind = "INDICATOR" | "PLACE" | "LEAD";

export interface SetupLinkSuggestion {
  /** `kind:planKey:value`; what a rejection remembers and an acceptance names. */
  id: string;
  kind: SetupLinkKind;
  planKey: string;
  /** An indicator code, a place name or a team member's key. */
  value: string;
  /** Plain words: why this is offered. */
  reason: string;
}

export interface SetupLinkSuggester {
  key: string;
  suggest: (draft: SetupDraft) => SetupLinkSuggestion[];
}

const make = (kind: SetupLinkKind, planKey: string, value: string, reason: string): SetupLinkSuggestion => ({ id: `${kind}:${planKey}:${value}`, kind, planKey, value, reason });
const padded = (text: string): string => ` ${normalizeLocationKey(text)} `;

const planItems = (d: SetupDraft) => live(d.proposal.plan).map((def) => ({ def, key: planKeyOf(def) }));

/** The indicators that measure the output an activity belongs to (or the activity itself). */
const indicatorsForActivity: SetupLinkSuggester = {
  key: "planToIndicator",
  suggest: (d) => {
    const nodes = live(d.proposal.logframe);
    const indicators = live(d.proposal.indicators);
    return planItems(d).flatMap(({ def, key }) => {
      const activity = nodes.find((n) => n.level === "ACTIVITY" && n.code !== null && n.code === def.logframeCode);
      if (!activity) return [];
      const output = nodes.find((n) => n.code !== null && n.code === activity.parentCode);
      const have = new Set(d.extras.planSetup[key]?.indicatorCodes ?? []);
      return indicators
        .filter((i) => i.code !== null && !have.has(i.code) && (i.logframeCode === activity.code || (output !== undefined && i.logframeCode === output.code)))
        .map((i) => make("INDICATOR", key, i.code as string, i.logframeCode === activity.code ? `It measures this activity (${activity.code}).` : `It measures ${output!.title ?? output!.code}, which this activity belongs to.`));
    });
  },
};

/** The places the activity's own words name. */
const placesNamedInActivity: SetupLinkSuggester = {
  key: "planToPlace",
  suggest: (d) => {
    const places = live(d.proposal.places).filter((p) => p.name && normalizeLocationKey(p.name).length >= 3);
    return planItems(d).flatMap(({ def, key }) => {
      const have = new Set((d.extras.planSetup[key]?.placeNames ?? []).map((n) => normalizeLocationKey(n)));
      const inTitle = padded(def.title ?? "");
      const inLocation = padded(def.location ?? "");
      return places.flatMap((p) => {
        const needle = ` ${normalizeLocationKey(p.name as string)} `;
        if (have.has(needle.trim())) return [];
        if (inLocation.includes(needle)) return [make("PLACE", key, p.name as string, `The work plan puts this activity in ${p.name}.`)];
        if (inTitle.includes(needle)) return [make("PLACE", key, p.name as string, `${p.name} is named in the activity's title.`)];
        return [];
      });
    });
  },
};

/** The team member the work plan names as lead, else the only field officer. */
const leadFromPlan: SetupLinkSuggester = {
  key: "planToLead",
  suggest: (d) => {
    const team = d.extras.team;
    const fieldOfficers = team.filter((p) => p.role === "FIELD_OFFICER" && !p.external);
    return planItems(d).flatMap(({ def, key }) => {
      if (d.extras.planSetup[key]?.leadKey !== undefined) return [];
      const named = def.lead ? team.find((p) => normalizeLocationKey(p.name) === normalizeLocationKey(def.lead as string)) : undefined;
      if (named) return [make("LEAD", key, named.key, `The work plan names ${named.name} as the lead.`)];
      if (fieldOfficers.length === 1) return [make("LEAD", key, fieldOfficers[0]!.key, `${fieldOfficers[0]!.name} is the only field officer on the team.`)];
      return [];
    });
  },
};

export const SETUP_LINK_SUGGESTERS: readonly SetupLinkSuggester[] = [indicatorsForActivity, placesNamedInActivity, leadFromPlan];

/** Everything the suggesters offer now, minus what the person rejected. */
export function suggestSetupLinks(draft: SetupDraft): SetupLinkSuggestion[] {
  const rejected = new Set(draft.extras.rejectedSuggestions);
  const seen = new Set<string>();
  return SETUP_LINK_SUGGESTERS.flatMap((s) => s.suggest(draft)).filter((s) => !rejected.has(s.id) && !seen.has(s.id) && seen.add(s.id));
}
