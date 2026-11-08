/**
 * A sector's pack, part by part (Phase 46). Each of the eleven parts has one provider that turns a sector's content (and what
 * every sector shares) into that part's items, or says why the part is empty. A provider answers for any sector: it never
 * throws for "unsupported", it returns an empty part with a reason, so providers can be swapped for one another. A new part is a
 * key in `PACK_PART_KEYS` and a row here.
 */
import type {
  AssessmentQuestion, BlueprintSection, LibraryChecklistItem, LibraryEvidenceType, FormSketch, GlossaryEntry, LibraryIndicator, LogframeSkeletonNode,
  PackPartKey, RiskSketch, SectorContent,
} from "./model.js";
import { PACK_PART_KEYS } from "./model.js";
import { COMMON_ASSESSMENT, COMMON_BLUEPRINT, COMMON_CHECKLIST, COMMON_EVIDENCE, COMMON_GLOSSARY, COMMON_RISKS } from "./data/common.js";
import { dashboardTemplateIdFor, canvasTemplateIdFor, headlineIndicators } from "./headline.js";

export interface PackPart { key: PackPartKey; items: readonly unknown[]; /** Why the part is empty, when it is. */ because?: string }
type Provider = (c: SectorContent) => PackPart;

const part = (key: PackPartKey, items: readonly unknown[], because?: string): PackPart => (items.length > 0 ? { key, items } : { key, items, because: because ?? "Nothing is offered for this part." });
const merge = <T extends { key?: string; term?: string; title?: string }>(common: readonly T[], own: readonly T[]): T[] => {
  const id = (x: T) => x.key ?? x.term ?? x.title ?? "";
  const ownIds = new Set(own.map(id));
  return [...own, ...common.filter((c) => !ownIds.has(id(c)))];
};

/** The generic canvas starters that suit any sector. */
export const GENERAL_CANVAS_STARTERS: readonly string[] = ["builtin-results-glance", "builtin-people-reached", "builtin-flash-update", "builtin-sector-scorecard"];

export const PACK_PART_PROVIDERS: Readonly<Record<PackPartKey, Provider>> = {
  indicators: (c) => part("indicators", c.indicators, c.noneBecause?.indicators),
  logframe: (c) => part("logframe", c.logframe as readonly LogframeSkeletonNode[], c.noneBecause?.logframe),
  assessment: (c) => part("assessment", merge<AssessmentQuestion>(COMMON_ASSESSMENT, c.assessment)),
  forms: (c) => part("forms", c.forms as readonly FormSketch[], c.noneBecause?.forms),
  evidence: (c) => part("evidence", merge<LibraryEvidenceType>(COMMON_EVIDENCE, c.evidence)),
  checklist: (c) => part("checklist", merge<LibraryChecklistItem>(COMMON_CHECKLIST, c.checklist)),
  risks: (c) => part("risks", [...c.risks, ...COMMON_RISKS.filter((r) => !c.risks.some((x) => x.title === r.title))] as readonly RiskSketch[]),
  glossary: (c) => part("glossary", merge<GlossaryEntry>(COMMON_GLOSSARY, c.glossary)),
  blueprint: (c) => part("blueprint", merge<BlueprintSection>(COMMON_BLUEPRINT, c.blueprint)),
  dashboards: (c) => {
    const ids = [...c.dashboardTemplates, ...(c.dashboardTemplates.length === 0 && headlineIndicators(c).length >= 4 ? [dashboardTemplateIdFor(c.sectorId)] : [])];
    return part("dashboards", ids, c.noneBecause?.dashboards ?? "Fewer than four indicators are marked as headline indicators, so no results dashboard is built for this sector yet.");
  },
  infographics: (c) => part("infographics", [...(headlineIndicators(c).length >= 4 ? [canvasTemplateIdFor(c.sectorId)] : []), ...GENERAL_CANVAS_STARTERS]),
};

/** Every part of a sector's pack, in order. */
export function packOf(content: SectorContent): PackPart[] {
  return PACK_PART_KEYS.map((k) => PACK_PART_PROVIDERS[k](content));
}

export const indicatorsOfPart = (p: PackPart): readonly LibraryIndicator[] => p.items as readonly LibraryIndicator[];
