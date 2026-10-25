/**
 * The description published with an infographic (Phase 32.7): what a person who cannot see the image
 * needs, built from the design and the same figures the image shows. Plain sentences, no markup.
 */
import { spanOf, type InfographicConfig } from "./composition.js";
import { DEFAULT_SECTION_LABEL } from "./templates.js";
import { labelsFor, SECTION_LABELS_FOR_ALT } from "./labels.js";

export interface AltTextFacts {
  title: string;
  country?: string;
  reachUnique: number;
  activitiesDone: number;
  activitiesPlanned: number;
  periodLabel?: string;
}

export function buildAltText(config: InfographicConfig, facts: AltTextFacts): string {
  const l = labelsFor(config.language);
  const sections = config.sections.filter((s) => !s.hidden);
  const names = [...new Set(sections.map((s) => s.title ?? SECTION_LABELS_FOR_ALT(s.kind, config.language, DEFAULT_SECTION_LABEL[s.kind])).filter(Boolean))];
  const parts: string[] = [`${facts.title}.`];
  if (facts.country || facts.periodLabel) parts.push([facts.country, facts.periodLabel].filter(Boolean).join(", ") + ".");
  const figures: string[] = [];
  if (facts.reachUnique > 0) figures.push(`${l.peopleReached}: ${facts.reachUnique.toLocaleString("en-US")}`);
  if (facts.activitiesPlanned > 0) figures.push(`${l.activitiesCompletedOfPlanned}: ${facts.activitiesDone} / ${facts.activitiesPlanned}`);
  if (figures.length > 0) parts.push(`${figures.join("; ")}.`);
  const messages = sections.flatMap((s) => s.messages ?? []).map((m) => m.text);
  if (messages.length > 0) parts.push(`${messages.slice(0, 3).join(" ")}`);
  if (names.length > 0) parts.push(`${names.slice(0, 8).join(", ")}.`);
  void spanOf;
  return parts.join(" ").slice(0, 900);
}
