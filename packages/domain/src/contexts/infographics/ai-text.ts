/**
 * Model-written infographic text (Phase 32.8b). Opt-in and always a proposal: the model is given only
 * the recorded figures (`StoryFacts`), its reply is parsed strictly, and any sentence that states a
 * number the facts do not hold is dropped. A person accepts or edits what is left; nothing is saved here.
 */
import { INFOGRAPHIC_LANGUAGE_LABEL, resolveLanguage } from "./labels.js";
import { tryParseJson } from "../../core/json-repair.js";
import type { StoryFacts } from "./suggest.js";

export interface AiTextProposal {
  headlines: Array<{ text: string; basis: "AI" }>;
  messages: Array<{ text: string; basis: "AI" }>;
  /** Sentences removed because they stated a figure the records do not hold. */
  droppedUngrounded: number;
}

const digitsOf = (text: string): string[] => (text.match(/\d[\d,.\s]*\d|\d/g) ?? []).map((t) => t.replace(/[\s,]/g, "").replace(/\.(?=\d{3}\b)/g, "")).filter(Boolean);

/** Every number the facts state, plus the roundings a writer may legitimately use (hundreds, thousands, whole percent). */
export function allowedStoryFigures(facts: StoryFacts): Set<string> {
  const out = new Set<string>();
  const add = (value: number | string | undefined): void => {
    if (value === undefined) return;
    for (const token of digitsOf(String(value))) {
      out.add(token);
      const n = Number(token);
      if (Number.isFinite(n)) {
        out.add(String(Math.round(n)));
        if (n >= 100) out.add(String(Math.round(n / 100) * 100));
        if (n >= 1000) out.add(String(Math.round(n / 1000) * 1000));
      }
    }
  };
  [facts.reachUnique, facts.activitiesDone, facts.activitiesPlanned, facts.locations.length].forEach(add);
  for (const i of facts.indicators) {
    add(i.value);
    add(i.target);
    if (!i.isRate) add(i.percentOfTarget);
  }
  [facts.projectTitle, facts.country, ...facts.locations, ...facts.indicators.map((i) => i.name)].forEach(add);
  return out;
}

export const ungroundedFigures = (text: string, allowed: ReadonlySet<string>): string[] => digitsOf(text).filter((t) => !allowed.has(t) && !allowed.has(String(Math.round(Number(t)))));

export function buildAiTextPrompt(facts: StoryFacts, languageIn?: string): { system: string; user: string } {
  const lang = resolveLanguage(languageIn);
  const lines = [
    `Project: ${facts.projectTitle}`,
    facts.country ? `Country: ${facts.country}` : "",
    facts.locations.length ? `Locations: ${facts.locations.slice(0, 8).join(", ")}` : "",
    `People reached (unique): ${facts.reachUnique}`,
    `Activities completed: ${facts.activitiesDone} of ${facts.activitiesPlanned} planned`,
    ...facts.indicators.slice(0, 8).map((i) => `Indicator: ${i.name} = ${i.value}${i.target ? ` (target ${i.target})` : ""}${!i.isRate && i.percentOfTarget !== undefined ? `, ${Math.round(i.percentOfTarget)}% of target` : ""}${i.isRate ? " (a rate)" : ""}`),
  ].filter(Boolean);
  return {
    system:
      "You write short text for a humanitarian infographic. Use ONLY the facts given. Never introduce, estimate, sum or compute a number that is not in the facts. Plain language, sentence case, no jargon, no claims about causes or impact. " +
      `Write in ${INFOGRAPHIC_LANGUAGE_LABEL[lang]}. Reply with JSON only: {"headlines":[up to 3 strings, each under 100 characters],"messages":[3 to 5 strings, each one sentence]}.`,
    user: lines.join("\n"),
  };
}

/**
 * Parses the reply and keeps only grounded sentences. A reasoning model can spend part of its
 * output budget on hidden thinking before it writes the JSON, so the reply is sometimes cut off
 * mid-structure; `tryParseJson` repairs that (closing what was left open) rather than discarding
 * a reply that was merely truncated. It never invents a sentence the model did not write.
 */
export function groundAiText(raw: string, facts: StoryFacts): AiTextProposal {
  const start = raw.indexOf("{");
  let parsed: unknown;
  if (start >= 0) {
    const end = raw.lastIndexOf("}");
    // Try the slice up to the last closing brace first (handles trailing commentary after valid
    // JSON); if that does not parse even after repair, try to the end of the reply (handles a
    // reply cut off before any closing brace was ever written).
    parsed = end > start ? tryParseJson(raw.slice(start, end + 1)) : undefined;
    if (parsed === undefined) parsed = tryParseJson(raw.slice(start));
  }
  const allowed = allowedStoryFigures(facts);
  let dropped = 0;
  const pick = (value: unknown, max: number, limit: number): Array<{ text: string; basis: "AI" }> => {
    if (!Array.isArray(value)) return [];
    const out: Array<{ text: string; basis: "AI" }> = [];
    for (const item of value) {
      if (typeof item !== "string") continue;
      const text = item.replace(/\s+/g, " ").trim();
      if (!text || text.length > max) continue;
      if (ungroundedFigures(text, allowed).length > 0) {
        dropped += 1;
        continue;
      }
      if (out.length < limit) out.push({ text, basis: "AI" });
    }
    return out;
  };
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as { headlines?: unknown; messages?: unknown };
  return { headlines: pick(obj.headlines, 120, 3), messages: pick(obj.messages, 240, 5), droppedUngrounded: dropped };
}
