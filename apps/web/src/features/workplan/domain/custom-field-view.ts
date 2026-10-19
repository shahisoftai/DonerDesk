/** Pure helpers for the project's own fields on a planned activity (phase 28.1-C). No React, so they are unit-tested. */
export interface ViewField { id: string; type: "TEXT" | "NUMBER" | "DATE" | "CHOICE"; choices: string[] }

/** The starting text in each field: what was saved, or nothing. */
export function fieldDraft(fields: ReadonlyArray<ViewField>, values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.id, values[f.id] ?? ""]));
}

/**
 * What to send for the fields: every field, with a blank one as null (so a cleared answer is removed, never kept as 0).
 */
export function fieldPayload(fields: ReadonlyArray<ViewField>, draft: Record<string, string>): Array<{ fieldId: string; value: string | null }> {
  return fields.map((f) => {
    const raw = (draft[f.id] ?? "").trim();
    return { fieldId: f.id, value: raw === "" ? null : raw };
  });
}

export function fieldTypeWords(type: ViewField["type"]): string {
  return { TEXT: "Text", NUMBER: "A number", DATE: "A date", CHOICE: "One choice from a list" }[type];
}

/** One choice per line; blank lines are ignored, and the server refuses fewer than two. */
export function parseChoiceLines(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line !== "");
}
