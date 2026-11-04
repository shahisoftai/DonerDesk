/**
 * Template text nobody filled in (Phase 42): pooled-fund and donor forms ship with prompts such as "To be completed after
 * identification of priority interventions", "[insert target districts/regions]" or "Standard Activity: Not Selected". They are
 * real words of the document, so they pass the quote check, but they state nothing. One table of patterns, used by grounding:
 * an item that is only a placeholder is left out (`TEMPLATE_PLACEHOLDER`); a placeholder inside longer text is removed from the
 * value and the item is marked LOW confidence for the person to check. A new pattern is one row and one test. Pure.
 */
export const TEMPLATE_PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /\bto be (completed|determined|confirmed|defined|added|filled( in)?)\b[^.;\n]*/i,
  /\[\s*(insert|add|enter|specify|name|describe)\b[^\]]*\]/i,
  /<\s*(insert|add|enter|specify)\b[^>]*>/i,
  /\bnot selected\b/i,
  /\b(tbd|tbc|xxx+|lorem ipsum)\b/i,
];

/** A bare label with only a number ("Activity 1.1.1", "Output 2", "Indicator 1.1.1(Standard)") names a slot, not an item. */
const BARE_LABEL = /^((outcome|output|activity)\s+)?(goal|impact|outcome|output|activity|indicator|objective|result|risk)\s*[\d.]+\s*(\((standard|custom)\))?\s*[-:.]*\s*$/i;

/** Placeholder fragments in a text (empty when there are none). */
export const placeholdersIn = (text: string): string[] =>
  TEMPLATE_PLACEHOLDER_PATTERNS.flatMap((re) => { const m = new RegExp(re.source, re.flags).exec(text); return m ? [m[0]] : []; });

/** The text without its placeholder fragments and the punctuation left dangling ("in [insert districts]." -> "in."). */
export function withoutPlaceholders(text: string): string {
  let out = text;
  for (const re of TEMPLATE_PLACEHOLDER_PATTERNS) out = out.replace(new RegExp(re.source, `${re.flags.replace("g", "")}g`), "");
  return out.replace(/\s+([.,;:])/g, "$1").replace(/\s{2,}/g, " ").replace(/^[\s\-–:.,;]+|[\s\-–:,;]+$/g, "").trim();
}

/** "WHOLE" when nothing meaningful is left without the placeholders (or the text is a bare label), "PART" when some is, else null. */
export function templatePlaceholder(text: string | null | undefined): "WHOLE" | "PART" | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  if (BARE_LABEL.test(t)) return "WHOLE";
  // "Activity 1.1.1 - To be completed after identification of priority i..." is a label followed by a placeholder.
  const rest = withoutPlaceholders(t).replace(/^(standard\s+activity|goal|impact|outcome|output|activity|indicator|objective|result)\s*[\d.]*\s*(\((standard|custom)\))?\s*[-:.]?\s*/i, "");
  if (placeholdersIn(t).length === 0) return null;
  return rest.replace(/[.…\s]/g, "").length < 3 ? "WHOLE" : "PART";
}
