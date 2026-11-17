/**
 * What is kept of a list's address (Phase 59): the filters and sort, never the page number, so coming back to a list opens it as the
 * person last left it. Pure. An address with nothing to keep gives "" (which clears what was remembered).
 */
const NOT_KEPT = new Set(["page", "cursor", "focus"]);

export function filtersToRemember(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const kept = new URLSearchParams();
  for (const [key, value] of params) if (!NOT_KEPT.has(key) && value !== "") kept.append(key, value);
  return kept.toString();
}

/** A remembered query is only restored into an address that has none of its own, and only when it is plain filter text. */
export const isRestorable = (remembered: string): boolean => remembered.length > 0 && remembered.length <= 500 && !/[<>\s]/.test(remembered);
