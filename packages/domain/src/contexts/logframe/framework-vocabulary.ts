import { findRawTokens } from "../../core/copy-lint.js";
import { LOGFRAME_LEVELS, type LogframeLevel } from "./logframe-item.js";

/**
 * What a donor calls the levels of the results chain and the document itself. The stored `level` never changes: only the
 * words shown do, so a project can be read as a Logframe, a Results Framework or an intervention logic from the same rows.
 */
export interface FrameworkVocabulary {
  /** What the document is called ("Logframe", "Results Framework"). */
  document: string;
  /** One word per level; every level is named. */
  levels: Record<LogframeLevel, string>;
}

export type VocabularyPresetKey = "DONORDESK" | "USAID" | "FCDO" | "EU" | "UN" | "CUSTOM";

export interface VocabularyPreset {
  key: VocabularyPresetKey;
  /** Shown in the picker; a proper noun, so it is not translated. */
  label: string;
  vocabulary: FrameworkVocabulary;
}

/** One row per donor. Adding a donor's words is a row here and nothing else. */
export const VOCABULARY_PRESETS: ReadonlyArray<VocabularyPreset> = [
  { key: "DONORDESK", label: "DonorDesk", vocabulary: { document: "Logframe", levels: { GOAL: "Goal", OUTCOME: "Outcome", OUTPUT: "Output", ACTIVITY: "Activity" } } },
  { key: "USAID", label: "USAID", vocabulary: { document: "Results Framework", levels: { GOAL: "Goal", OUTCOME: "Intermediate Result", OUTPUT: "Sub-Intermediate Result", ACTIVITY: "Activity" } } },
  { key: "FCDO", label: "FCDO", vocabulary: { document: "Logframe", levels: { GOAL: "Impact", OUTCOME: "Outcome", OUTPUT: "Output", ACTIVITY: "Activity" } } },
  { key: "EU", label: "European Union", vocabulary: { document: "Intervention logic", levels: { GOAL: "Overall objective", OUTCOME: "Specific objective", OUTPUT: "Result", ACTIVITY: "Activity" } } },
  { key: "UN", label: "United Nations", vocabulary: { document: "Results Framework", levels: { GOAL: "Impact", OUTCOME: "Outcome", OUTPUT: "Output", ACTIVITY: "Activity" } } },
];

export const DEFAULT_VOCABULARY: FrameworkVocabulary = VOCABULARY_PRESETS[0]!.vocabulary;

export const MAX_VOCABULARY_WORD = 40;

export function presetVocabulary(key: string): FrameworkVocabulary | undefined {
  return VOCABULARY_PRESETS.find((p) => p.key === key)?.vocabulary;
}

/** What a level is called under a vocabulary. */
export function levelName(level: LogframeLevel, vocabulary: FrameworkVocabulary = DEFAULT_VOCABULARY): string {
  return vocabulary.levels[level] || DEFAULT_VOCABULARY.levels[level];
}

export function documentName(vocabulary: FrameworkVocabulary = DEFAULT_VOCABULARY): string {
  return vocabulary.document || DEFAULT_VOCABULARY.document;
}

export type VocabularyProblem =
  | { code: "EMPTY"; field: string }
  | { code: "TOO_LONG"; field: string }
  | { code: "RAW_TOKEN"; field: string }
  | { code: "DUPLICATE"; field: string };

/** The words a person typed must be four distinct, readable level names and a document name. */
export function vocabularyProblems(input: FrameworkVocabulary): VocabularyProblem[] {
  const problems: VocabularyProblem[] = [];
  const check = (field: string, value: string) => {
    const text = (value ?? "").trim();
    if (!text) problems.push({ code: "EMPTY", field });
    else if (text.length > MAX_VOCABULARY_WORD) problems.push({ code: "TOO_LONG", field });
    else if (findRawTokens(text).length > 0) problems.push({ code: "RAW_TOKEN", field });
  };
  check("document", input.document);
  const seen = new Set<string>();
  for (const level of LOGFRAME_LEVELS) {
    const text = input.levels?.[level] ?? "";
    check(level, text);
    const key = text.trim().toLowerCase();
    if (key && seen.has(key)) problems.push({ code: "DUPLICATE", field: level });
    seen.add(key);
  }
  return problems;
}

/** Stored text -> vocabulary. Anything unreadable or incomplete reads as the default, never as a half-named chain. */
export function parseVocabulary(json: string | null | undefined): FrameworkVocabulary {
  if (!json) return DEFAULT_VOCABULARY;
  try {
    const raw = JSON.parse(json) as Partial<FrameworkVocabulary> | null;
    if (!raw || typeof raw !== "object" || typeof raw.document !== "string" || typeof raw.levels !== "object" || raw.levels === null) return DEFAULT_VOCABULARY;
    const levels = {} as Record<LogframeLevel, string>;
    for (const level of LOGFRAME_LEVELS) {
      const word = (raw.levels as Record<string, unknown>)[level];
      if (typeof word !== "string") return DEFAULT_VOCABULARY;
      levels[level] = word.trim();
    }
    const vocabulary = { document: raw.document.trim(), levels };
    return vocabularyProblems(vocabulary).length === 0 ? vocabulary : DEFAULT_VOCABULARY;
  } catch {
    return DEFAULT_VOCABULARY;
  }
}

/** True when these are the default words, so a screen or file can leave its own words alone. */
export function isDefaultVocabulary(vocabulary: FrameworkVocabulary): boolean {
  return LOGFRAME_LEVELS.every((l) => vocabulary.levels[l] === DEFAULT_VOCABULARY.levels[l]);
}

/** The preset whose words these are, or CUSTOM. */
export function presetKeyOf(vocabulary: FrameworkVocabulary): VocabularyPresetKey {
  const same = (a: FrameworkVocabulary, b: FrameworkVocabulary) => a.document === b.document && LOGFRAME_LEVELS.every((l) => a.levels[l] === b.levels[l]);
  return VOCABULARY_PRESETS.find((p) => same(p.vocabulary, vocabulary))?.key ?? "CUSTOM";
}
