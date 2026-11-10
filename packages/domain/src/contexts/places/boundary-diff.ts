/**
 * What changed between two versions of an official boundary set (Phase 49.3), by P-code. Pure.
 * A new OCHA COD-AB release can add units, retire them, or move them under another parent; a place whose code was retired is then joined to
 * nothing and must be confirmed by a person. Stored places are never rewritten: this only lists the codes, and the screen asks.
 */

export interface BoundaryCodeRow { pcode: string; name: string; parentPcode?: string | undefined }

export interface BoundaryDiff {
  appeared: BoundaryCodeRow[];
  disappeared: BoundaryCodeRow[];
  /** Same code, another parent. */
  reparented: Array<{ pcode: string; name: string; from: string; to: string }>;
  /** Same code, another name (a spelling fix or a renaming). */
  renamed: Array<{ pcode: string; from: string; to: string }>;
}

const key = (code: string): string => code.trim().toUpperCase();

/** Units without a code cannot be followed from one version to the next and are left out of every list. */
export function diffBoundaryVersions(before: readonly BoundaryCodeRow[], after: readonly BoundaryCodeRow[]): BoundaryDiff {
  const old = new Map(before.filter((r) => key(r.pcode)).map((r) => [key(r.pcode), r]));
  const now = new Map(after.filter((r) => key(r.pcode)).map((r) => [key(r.pcode), r]));
  const out: BoundaryDiff = { appeared: [], disappeared: [], reparented: [], renamed: [] };
  for (const [code, row] of now) if (!old.has(code)) out.appeared.push(row);
  for (const [code, row] of old) {
    const next = now.get(code);
    if (!next) { out.disappeared.push(row); continue; }
    const from = key(row.parentPcode ?? ""), to = key(next.parentPcode ?? "");
    if (from !== to) out.reparented.push({ pcode: row.pcode, name: next.name, from, to });
    if (row.name.trim() !== next.name.trim()) out.renamed.push({ pcode: row.pcode, from: row.name, to: next.name });
  }
  const byCode = (a: { pcode: string }, b: { pcode: string }) => a.pcode.localeCompare(b.pcode);
  out.appeared.sort(byCode); out.disappeared.sort(byCode); out.reparented.sort(byCode); out.renamed.sort(byCode);
  return out;
}

/** True when nothing a stored place could depend on changed. */
export const isBoundaryDiffEmpty = (d: BoundaryDiff): boolean => d.appeared.length + d.disappeared.length + d.reparented.length + d.renamed.length === 0;

/** The places (by their code) that a diff leaves pointing at a retired or moved unit, for "Places to confirm". */
export function placesAffectedByDiff<P extends { code?: string | null | undefined }>(places: readonly P[], diff: BoundaryDiff): Array<{ place: P; reason: "RETIRED" | "MOVED" }> {
  const retired = new Set(diff.disappeared.map((r) => key(r.pcode)));
  const moved = new Set(diff.reparented.map((r) => key(r.pcode)));
  const out: Array<{ place: P; reason: "RETIRED" | "MOVED" }> = [];
  for (const place of places) {
    const code = key(place.code ?? "");
    if (!code) continue;
    if (retired.has(code)) out.push({ place, reason: "RETIRED" });
    else if (moved.has(code)) out.push({ place, reason: "MOVED" });
  }
  return out;
}
