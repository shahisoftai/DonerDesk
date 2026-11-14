import type { CanvasPage } from "../../canvas/canvas.js";
import { visualFamilyDef, type WellKey } from "../../visual-data/wells.js";
import type { ChartReference } from "../../visual-data/references.js";
import type { KitMapping } from "./match-kit.js";
import type { Kit, KitBlock } from "./model.js";

/**
 * A kit's pages as canvas pages (§3.8), pure: every block names kit roles, which the mapping turns into the dataset's column keys. A
 * block whose role no column fills is left out and named ("No supply columns: Supplies page skipped"); a page left with nothing is
 * skipped and named. Only existing block kinds are used.
 */
export interface BuildContext { kit: Kit; mapping: KitMapping; source: string; reviewNote: string }
type Built = { kind: string; props: Record<string, unknown> } | { missing: string[] };

const col = (ctx: BuildContext, role: string): string | undefined => ctx.mapping[role];
const label = (ctx: BuildContext, role: string): string => ctx.kit.columns.find((c) => c.role === role)?.label ?? ctx.kit.figures.find((f) => f.id === role)?.label ?? role;

function visual(b: KitBlock, ctx: BuildContext): Built {
  const family = b.family ?? "BAR";
  const def = visualFamilyDef(family);
  const missing: string[] = [];
  const wells: Partial<Record<WellKey, Array<{ ref: string; aggregate?: string }>>> = {};
  const calculated: Array<Record<string, unknown>> = [];
  const hidden: Array<{ ref: string }> = [];
  for (const [well, fields] of Object.entries(b.wells ?? {}) as Array<[WellKey, NonNullable<KitBlock["wells"]>[WellKey]]>) {
    for (const f of fields ?? []) {
      const figure = ctx.kit.figures.find((x) => x.id === f.role);
      if (figure) {
        const terms = figure.terms.map((t) => col(ctx, t));
        if (terms.some((t) => !t)) { missing.push(figure.label); continue; }
        calculated.push({ id: figure.id, label: figure.label, op: figure.op, terms, ...(figure.percent ? { percent: true } : {}) });
        for (const t of terms) if (!hidden.some((h) => h.ref === t)) hidden.push({ ref: t! });
        continue;
      }
      const key = col(ctx, f.role);
      if (!key) { missing.push(label(ctx, f.role)); continue; }
      (wells[well] ??= []).push({ ref: key, ...(f.aggregate ? { aggregate: f.aggregate } : {}) });
    }
  }
  if (missing.length) return { missing };
  if (hidden.length) wells.TOOLTIP = [...(wells.TOOLTIP ?? []), ...hidden];
  const references: ChartReference[] = def?.references ? (b.thresholds ?? []).flatMap((id) => {
    const t = ctx.kit.thresholds.find((x) => x.id === id);
    return t ? [{ kind: "LINE" as const, value: t.value, label: t.label, role: t.role, source: `${t.source}${ctx.reviewNote}` }] : [];
  }) : [];
  return {
    kind: "DATA_VISUAL",
    props: {
      source: ctx.source, family, wells, crossFilter: true, ...(b.title ? { title: b.title, altText: b.title } : {}),
      ...(calculated.length ? { calculated } : {}), ...(references.length ? { references, sourceNote: `Reference lines: ${references[0]!.source}.` } : {}),
      ...(b.sort ? { sort: b.sort } : {}), ...(b.topN ? { topN: b.topN } : {}),
    },
  };
}

const needRoles = (ctx: BuildContext, roles: ReadonlyArray<string>): string[] => roles.filter((r) => !col(ctx, r) && !ctx.kit.figures.some((f) => f.id === r)).map((r) => label(ctx, r));
const one = (b: KitBlock, key: string): string => String((b.roles ?? {})[key] ?? "");
const many = (b: KitBlock, key: string): string[] => { const v = (b.roles ?? {})[key]; return Array.isArray(v) ? [...v] : v ? [v as string] : []; };

/** The kit block types, as rows. A new type is a row here; `buildPages` is untouched. */
export const KIT_BLOCK_BUILDERS: Readonly<Record<string, (b: KitBlock, ctx: BuildContext) => Built>> = {
  VISUAL: visual,
  SLICER: (b, ctx) => { const m = needRoles(ctx, [one(b, "column")]); return m.length ? { missing: m } : { kind: "DATA_SLICER", props: { source: ctx.source, column: col(ctx, one(b, "column")), multi: true, ...(b.title ? { label: b.title } : {}) } }; },
  COMPLETENESS: (b, ctx) => {
    const m = needRoles(ctx, [one(b, "unit")]);
    if (m.length) return { missing: m };
    const group = one(b, "group") ? col(ctx, one(b, "group")) : undefined;
    return { kind: "DATA_COMPLETENESS", props: { source: ctx.source, unitColumn: col(ctx, one(b, "unit")), ...(group ? { groupColumn: group } : {}), ...(b.title ? { title: b.title } : {}) } };
  },
  DRIVERS: (b, ctx) => {
    const figure = ctx.kit.figures.find((f) => f.id === one(b, "outcome"));
    const candidates = many(b, "candidates").map((r) => col(ctx, r)).filter((x): x is string => Boolean(x));
    const m = needRoles(ctx, [one(b, "unit"), ...(figure ? figure.terms : [one(b, "outcome")])]);
    if (m.length || candidates.length === 0) return { missing: m.length ? m : ["the groups to compare"] };
    const outcome = figure ? { numerator: col(ctx, figure.terms[0]!), denominator: col(ctx, figure.terms[1]!), percent: Boolean(figure.percent), label: figure.label } : { column: col(ctx, one(b, "outcome")), label: label(ctx, one(b, "outcome")) };
    return { kind: "DATA_DRIVERS", props: { source: ctx.source, outcome, unitColumn: col(ctx, one(b, "unit")), candidates, ...(b.title ? { title: b.title } : {}) } };
  },
  TEXT: (b) => ({ kind: "TEXT", props: { text: b.text ?? "", role: "body" } }),
};

export interface BuiltPages { pages: CanvasPage[]; skipped: string[] }

/** Lays blocks out left to right on the 12-column grid, a new row when the next does not fit. Deterministic ids from the page and position. */
export function buildPages(kit: Kit, mapping: KitMapping, source: string): BuiltPages {
  const reviewNote = kit.reviewState === "REVIEWED" ? "" : " (unreviewed)";
  const ctx: BuildContext = { kit, mapping, source, reviewNote };
  const pages: CanvasPage[] = [];
  const skipped: string[] = [];
  for (const p of kit.pages) {
    let x = 0, y = 0, rowH = 0;
    const blocks: CanvasPage["blocks"] = [];
    const gaps = new Set<string>();
    p.blocks.forEach((b, i) => {
      const built = KIT_BLOCK_BUILDERS[b.type]?.(b, ctx) ?? { missing: [b.type] };
      if ("missing" in built) { for (const m of built.missing) gaps.add(m); return; }
      if (x + b.w > 12) { x = 0; y += rowH; rowH = 0; }
      blocks.push({ id: `${p.key}-${i + 1}`, kind: built.kind, bounds: { x, y, w: b.w, h: b.h }, props: built.props, bindings: [] });
      x += b.w; rowH = Math.max(rowH, b.h);
    });
    const meaningful = blocks.filter((b) => b.kind !== "TEXT" && b.kind !== "DATA_SLICER");
    if (meaningful.length === 0) { skipped.push(`${p.title} page skipped: no ${[...gaps].slice(0, 3).join(", ").toLowerCase() || "matching"} columns.`); continue; }
    if (gaps.size) skipped.push(`${p.title}: parts left out for want of ${[...gaps].slice(0, 4).join(", ").toLowerCase()}.`);
    pages.push({ id: p.key, title: p.title, format: "WEB_FLUID", blocks });
  }
  return { pages, skipped };
}
