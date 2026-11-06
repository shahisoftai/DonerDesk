/** Small readers over upstream proposal fields, so a prompt can name the codes and dates already read (never as quotable text). */
const valuesOf = (field: unknown): Record<string, unknown>[] =>
  Array.isArray(field) ? field.map((i) => (i as { value?: unknown }).value).filter((v): v is Record<string, unknown> => !!v && typeof v === "object") : [];

export const codesOf = (field: unknown): string[] =>
  valuesOf(field).map((v) => v.code).filter((c): c is string => typeof c === "string" && c !== "");

export function factValue(facts: unknown, key: string): string | null {
  const item = (facts as Record<string, { value?: unknown }> | undefined)?.[key];
  return typeof item?.value === "string" ? item.value : null;
}

export const datesLine = (facts: unknown): string =>
  `Project dates already read: start ${factValue(facts, "startDate") ?? "not stated"}, end ${factValue(facts, "endDate") ?? "not stated"}.`;
