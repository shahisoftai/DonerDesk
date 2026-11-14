import { headerWords } from "../guess/words.js";
import type { ColumnDef } from "../model.js";
import type { Kit, KitColumn } from "./model.js";

/** Which column fills each kit role. Saved on the dataset so the next upload maps itself (§3.8). */
export type KitMapping = Record<string, string>;

export interface KitMatch {
  mapping: KitMapping;
  matched: number;
  /** Roles of the kit no column fills (their blocks are left out with a note). */
  unmatched: string[];
  /** "This looks like the Nutrition kit (24 of 31 columns matched)". */
  sentence: string;
  /** Share of the kit's roles matched, 0..1. */
  score: number;
}

const fold = (t: string): string => headerWords(t).join(" ");

/**
 * Columns to kit roles (§3.8): a saved mapping first (the column with the same source header), then an alias (folded exact match),
 * then the person confirms. Each column fills at most one role, each role at most one column. Pure.
 */
export function matchKit(columns: readonly ColumnDef[], kit: Kit, saved: Readonly<Record<string, string>> = {}): KitMatch {
  const mapping: KitMapping = {};
  const used = new Set<string>();
  const byHeader = new Map(columns.map((c) => [fold(c.sourceHeader), c] as const));
  const take = (role: string, col: ColumnDef | undefined): void => { if (col && !used.has(col.key) && !mapping[role]) { mapping[role] = col.key; used.add(col.key); } };
  for (const [role, header] of Object.entries(saved)) take(role, byHeader.get(fold(header)));
  const aliases = (k: KitColumn): string[] => [k.label, ...k.aliases].map(fold);
  for (const k of kit.columns) for (const a of aliases(k)) take(k.role, byHeader.get(a));
  // Then by label (a column the person renamed to the kit's wording on the confirm screen).
  for (const k of kit.columns) take(k.role, columns.find((c) => fold(c.label) === fold(k.label)));
  const unmatched = kit.columns.filter((k) => !mapping[k.role]).map((k) => k.role);
  const matched = kit.columns.length - unmatched.length;
  const score = kit.columns.length ? matched / kit.columns.length : 0;
  return { mapping, matched, unmatched, score, sentence: `This looks like the ${kit.title} (${matched} of ${kit.columns.length} columns matched).` };
}

/** The kit's kind, meaning, unit and parts applied to the mapped columns; the person's own label and header are kept. */
export function applyKit(columns: readonly ColumnDef[], kit: Kit, mapping: KitMapping): ColumnDef[] {
  const roleOf = new Map(Object.entries(mapping).map(([role, key]) => [key, role]));
  const byRole = new Map(kit.columns.map((k) => [k.role, k]));
  return columns.map((c) => {
    const role = roleOf.get(c.key);
    const k = role ? byRole.get(role) : undefined;
    if (!k) return c;
    const parts = k.rateParts && mapping[k.rateParts.numerator] && mapping[k.rateParts.denominator] ? { numerator: mapping[k.rateParts.numerator]!, denominator: mapping[k.rateParts.denominator]!, percent: k.rateParts.percent } : undefined;
    // The kit's plain wording replaces a raw header ("TotalChildScreen" → "Children screened"); a name the person typed is kept.
    return { ...c, ...(c.label === c.sourceHeader ? { label: k.label } : {}), kind: k.kind, semantic: k.semantic, role: k.role, ...(k.unit ? { unit: k.unit } : {}), ...(parts ? { rateParts: parts } : {}) };
  });
}

/** The kit's checks with role params turned into column keys; a check naming an unmapped role is left out. */
export function kitChecks(kit: Kit, mapping: KitMapping): Array<{ id: string; check: string; label: string; severity?: Kit["checks"][number]["severity"]; params: Record<string, unknown> }> {
  const out = [];
  for (const c of kit.checks) {
    let ok = true;
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(c.params)) {
      if (typeof v === "string") { if (!mapping[v]) ok = false; params[k] = mapping[v]; }
      else if (Array.isArray(v)) { const mapped = v.map((x) => mapping[x as string]); if (mapped.some((x) => !x)) ok = false; params[k] = mapped; }
      else params[k] = v;
    }
    if (ok) out.push({ id: c.id, check: c.check, label: c.label, ...(c.severity ? { severity: c.severity } : {}), params });
  }
  return out;
}

/** The kit's figures as dataset figures (column keys), only those whose every term is mapped. */
export function kitFigures(kit: Kit, mapping: KitMapping) {
  return kit.figures.filter((f) => f.terms.every((t) => mapping[t])).map((f) => ({ id: f.id, label: f.label, op: f.op, terms: f.terms.map((t) => mapping[t]!), ...(f.percent ? { percent: true } : {}) }));
}
