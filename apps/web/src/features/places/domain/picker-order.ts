/**
 * The one place picker's order (Phase 56): this project's places first (its open areas and everything inside them, plus places it already
 * uses), then the rest of the organisation's list, labelled. Matching is on the whole path, so "Village 1 › Town T" tells two villages of one
 * name apart. Pure.
 */
export interface PickerChoice { id: string; name: string; path: string }
export interface PickerMatch extends PickerChoice { group: "PROJECT" | "ORGANISATION" }

export const PICKER_LIMIT = 10;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function pickerMatches(query: string, choices: readonly PickerChoice[], projectIds: ReadonlySet<string>, exclude: readonly string[], limit = PICKER_LIMIT): PickerMatch[] {
  const q = fold(query.trim());
  const skip = new Set(exclude);
  const pool = choices.filter((c) => !skip.has(c.id) && (!q || fold(c.path).includes(q)));
  // Names that start with the query come before names that merely contain it, inside each group.
  const rank = (c: PickerChoice) => (q && fold(c.name).startsWith(q) ? 0 : 1);
  const sort = (a: PickerChoice, b: PickerChoice) => rank(a) - rank(b) || a.path.localeCompare(b.path);
  const mine = pool.filter((c) => projectIds.has(c.id)).sort(sort).map((c) => ({ ...c, group: "PROJECT" as const }));
  if (!q) return mine.slice(0, limit);
  const rest = pool.filter((c) => !projectIds.has(c.id)).sort(sort).map((c) => ({ ...c, group: "ORGANISATION" as const }));
  return [...mine, ...rest].slice(0, limit);
}

/** Where a new place can be put from the picker: the project's own areas and places that can hold others (never a site). */
export function parentChoices(choices: ReadonlyArray<PickerChoice & { adminLevel: number; kind: "POINT" | "AREA" }>, projectIds: ReadonlySet<string>): PickerChoice[] {
  return choices.filter((c) => c.kind === "AREA" && c.adminLevel < 4 && projectIds.has(c.id)).sort((a, b) => a.path.localeCompare(b.path));
}
