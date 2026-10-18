/**
 * Words for "files we will need": the kinds of file in plain language, the line on an activity ("Still needed: attendance
 * sheet"), and the one question when accepting without them. Never a code. Pure.
 */
import { EVIDENCE_TYPE_LABEL } from "../../../lib/labels.ts";

const word = (type: string): string => (EVIDENCE_TYPE_LABEL[type] ?? "file").toLowerCase();

/** "attendance sheet", "attendance sheet and photo", "attendance sheet, photo and distribution list". */
export function fileWords(types: ReadonlyArray<string>): string {
  const words = types.map(word);
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

export function stillNeededLine(types: ReadonlyArray<string>): string {
  return types.length === 0 ? "" : `Still needed: ${fileWords(types)}`;
}

/** Shown once, in place of accepting straight away. It never blocks: "Accept anyway" always works. */
export function acceptQuestion(stillNeeded: ReadonlyArray<string>): string {
  return stillNeeded.length === 0 ? "" : `No ${fileWords(stillNeeded)} yet. Accept anyway?`;
}

/** The kinds a person can ask for (every kind except "Other", which names nothing). */
export function requirableTypes(): Array<{ id: string; label: string }> {
  return Object.entries(EVIDENCE_TYPE_LABEL).filter(([id]) => id !== "OTHER").map(([id, label]) => ({ id, label }));
}
