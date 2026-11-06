/**
 * Story suggestions (Phase 32.8): a headline, key messages and a starting template proposed from the
 * project's own records. Deterministic and grounded by construction: every sentence is a fixed
 * pattern filled with figures read straight from the facts passed in, so a suggestion can never
 * state a number the records do not hold. Nothing here calls a model; a person accepts, edits or
 * ignores each suggestion, and an accepted suggestion becomes ordinary authored text.
 */
import { formatNumber, resolveLanguage, type InfographicLanguage, type InfographicRounding } from "./labels.js";
import type { InfographicTemplateId } from "./templates.js";

/** The figures a suggestion may use (assembled by the caller from the enriched project read). */
export interface StoryFacts {
  projectTitle: string;
  country?: string;
  /** Location names with recorded results or planned work, most active first. */
  locations: readonly string[];
  reachUnique: number;
  activitiesDone: number;
  activitiesPlanned: number;
  financeEnabled: boolean;
  /** Indicators with a recorded value, best progress first. A rate never carries a percent of target. */
  indicators: ReadonlyArray<{ name: string; value: string; target?: string; percentOfTarget?: number; isRate: boolean }>;
}

const T = {
  en: {
    reach: "{n} people reached in {place}",
    reachNoPlace: "{n} people reached",
    done: "{done} of {planned} planned activities completed in {place}",
    doneNoPlace: "{done} of {planned} planned activities completed",
    target: "{name}: {pct}% of the target reached",
    msgReach: "{n} unique people have been reached so far.",
    msgActivities: "{done} of {planned} planned activities have been completed.",
    msgIndicator: "{name}: {value}{target}.",
    msgTarget: " against a target of {target} ({pct}%)",
    msgPlaces: "The work covers {n} locations, including {list}.",
    msgPlacesOne: "The work takes place in {list}.",
  },
  fr: {
    reach: "{n} personnes atteintes en {place}",
    reachNoPlace: "{n} personnes atteintes",
    done: "{done} activités prévues sur {planned} réalisées en {place}",
    doneNoPlace: "{done} activités prévues sur {planned} réalisées",
    target: "{name} : {pct} % de la cible atteinte",
    msgReach: "{n} personnes uniques ont été atteintes à ce jour.",
    msgActivities: "{done} des {planned} activités prévues ont été réalisées.",
    msgIndicator: "{name} : {value}{target}.",
    msgTarget: " pour une cible de {target} ({pct} %)",
    msgPlaces: "Le travail couvre {n} lieux, dont {list}.",
    msgPlacesOne: "Le travail se déroule à {list}.",
  },
  es: {
    reach: "{n} personas alcanzadas en {place}",
    reachNoPlace: "{n} personas alcanzadas",
    done: "{done} de {planned} actividades previstas realizadas en {place}",
    doneNoPlace: "{done} de {planned} actividades previstas realizadas",
    target: "{name}: {pct} % de la meta alcanzada",
    msgReach: "Hasta ahora se ha alcanzado a {n} personas únicas.",
    msgActivities: "Se han realizado {done} de las {planned} actividades previstas.",
    msgIndicator: "{name}: {value}{target}.",
    msgTarget: " frente a una meta de {target} ({pct} %)",
    msgPlaces: "El trabajo abarca {n} lugares, entre ellos {list}.",
    msgPlacesOne: "El trabajo se realiza en {list}.",
  },
  ar: {
    reach: "تم الوصول إلى {n} شخص في {place}",
    reachNoPlace: "تم الوصول إلى {n} شخص",
    done: "اكتمل {done} من {planned} نشاطاً مخططاً في {place}",
    doneNoPlace: "اكتمل {done} من {planned} نشاطاً مخططاً",
    target: "{name}: تحقق {pct}% من الهدف",
    msgReach: "تم الوصول حتى الآن إلى {n} شخص فريد.",
    msgActivities: "اكتمل {done} من أصل {planned} نشاطاً مخططاً.",
    msgIndicator: "{name}: {value}{target}.",
    msgTarget: " مقابل هدف قدره {target} ({pct}%)",
    msgPlaces: "يشمل العمل {n} مواقع، منها {list}.",
    msgPlacesOne: "يجري العمل في {list}.",
  },
} as const satisfies Record<InfographicLanguage, Record<string, string>>;

const sub = (template: string, values: Readonly<Record<string, string | number>>): string => template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

export interface Suggestion {
  text: string;
  /** Always "RECORDS": shown to the person as “Suggested from your records”. */
  basis: "RECORDS" | "AI";
}

export function suggestHeadlines(facts: StoryFacts, languageIn?: string, rounding: InfographicRounding = "NONE"): Suggestion[] {
  const lang = resolveLanguage(languageIn);
  const t = T[lang];
  const out: string[] = [];
  const place = facts.country?.trim();
  if (facts.reachUnique > 0) out.push(sub(place ? t.reach : t.reachNoPlace, { n: formatNumber(facts.reachUnique, lang, rounding), place: place ?? "" }));
  if (facts.activitiesPlanned > 0 && facts.activitiesDone > 0) out.push(sub(place ? t.done : t.doneNoPlace, { done: formatNumber(facts.activitiesDone, lang), planned: formatNumber(facts.activitiesPlanned, lang), place: place ?? "" }));
  const best = facts.indicators.find((i) => !i.isRate && i.percentOfTarget !== undefined && i.percentOfTarget > 0);
  if (best?.percentOfTarget !== undefined) out.push(sub(t.target, { name: best.name, pct: Math.round(best.percentOfTarget) }));
  if (out.length === 0 && facts.projectTitle.trim()) out.push(facts.projectTitle.trim());
  return out.slice(0, 3).map((text) => ({ text: text.length > 120 ? `${text.slice(0, 117)}…` : text, basis: "RECORDS" }));
}

export function suggestKeyMessages(facts: StoryFacts, languageIn?: string, rounding: InfographicRounding = "NONE"): Suggestion[] {
  const lang = resolveLanguage(languageIn);
  const t = T[lang];
  const out: string[] = [];
  if (facts.reachUnique > 0) out.push(sub(t.msgReach, { n: formatNumber(facts.reachUnique, lang, rounding) }));
  if (facts.activitiesPlanned > 0) out.push(sub(t.msgActivities, { done: formatNumber(facts.activitiesDone, lang), planned: formatNumber(facts.activitiesPlanned, lang) }));
  for (const indicator of facts.indicators.slice(0, 2)) {
    const withTarget = indicator.target && indicator.percentOfTarget !== undefined && !indicator.isRate ? sub(t.msgTarget, { target: indicator.target, pct: Math.round(indicator.percentOfTarget) }) : "";
    out.push(sub(t.msgIndicator, { name: indicator.name, value: indicator.value, target: withTarget }));
  }
  if (facts.locations.length > 1) out.push(sub(t.msgPlaces, { n: facts.locations.length, list: facts.locations.slice(0, 4).join(", ") }));
  else if (facts.locations.length === 1) out.push(sub(t.msgPlacesOne, { list: facts.locations[0] ?? "" }));
  return out.slice(0, 5).map((text) => ({ text: text.length > 160 ? `${text.slice(0, 157)}…` : text, basis: "RECORDS" }));
}

export interface TemplateSuggestion {
  templateId: InfographicTemplateId;
  reason: string;
}

/** Up to three starting templates, best first, chosen from what the project actually has. */
export function suggestTemplates(facts: StoryFacts): TemplateSuggestion[] {
  const out: TemplateSuggestion[] = [];
  const hasResults = facts.indicators.length > 0;
  if (facts.reachUnique > 0 && hasResults) out.push({ templateId: "DONOR_ONE_PAGER", reason: "People reached and indicator results are both recorded." });
  if (facts.locations.length >= 2) out.push({ templateId: "COVERAGE_BY_LOCATION", reason: `Work is recorded in ${facts.locations.length} locations.` });
  if (facts.reachUnique > 0) out.push({ templateId: "BENEFICIARY_PROFILE", reason: "People are registered, so a breakdown by sex, age and place is available." });
  if (facts.financeEnabled) out.push({ templateId: "FUNDING_SNAPSHOT", reason: "Verified finance is recorded." });
  if (facts.activitiesPlanned > 0 && out.length < 3) out.push({ templateId: "PROGRESS", reason: "A work plan with activities exists." });
  if (out.length === 0) out.push({ templateId: "OVERVIEW", reason: "Little is recorded yet; the overview works at any stage." });
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.templateId) ? false : (seen.add(s.templateId), true))).slice(0, 3);
}
