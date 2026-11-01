/**
 * A reader's value cut to the length the proposal contract allows (`packages/contracts/src/project-setup.ts`), at a word
 * boundary and marked with "…". A sheet cell can be far longer than a title may be; one over-long cell must never make the
 * whole proposal unreadable. The full words stay in the item's quote.
 */
export const FIELD_LIMITS = { title: 300, unit: 60, figure: 100, frequency: 120, verification: 300, category: 200, code: 40 } as const;

export function fit(text: string, max: number): string;
export function fit(text: string | null, max: number): string | null;
export function fit(text: string | null, max: number): string | null {
  if (text === null || text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
