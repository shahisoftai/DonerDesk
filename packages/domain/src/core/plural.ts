/**
 * One way to write a count and the words that agree with it, so no screen says "1 item still need attention".
 * Pure and dependency-free: used by the domain, the application and the web app.
 */

/** "1 item", "2 items", "0 items". Pass `many` for an irregular plural ("1 person", "2 people"). */
export function countOf(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The word that agrees with a count: `agree(n, "needs", "need")`. */
export function agree(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/** "3 sections still need attention" / "1 section still needs attention". */
export function stillNeed(n: number, one: string, many: string = `${one}s`, what = "attention"): string {
  return `${countOf(n, one, many)} still ${agree(n, "needs", "need")} ${what}`;
}
