import { isColumnKind } from "../column-kinds.js";
import { checkDef } from "../checks/registry.js";
import { isSemantic, semanticOf } from "../semantics.js";
import { visualFamilyDef } from "../../visual-data/wells.js";
import { KIT_BLOCK_BUILDERS } from "./build-pages.js";
import type { Kit } from "./model.js";

/**
 * The one check every kit passes (the kit contract, §1.5 L): roles unique and known everywhere they are used, kinds and meanings
 * allowed together, figures from figure roles, checks known, thresholds on known figures, blocks of known types with wells their visual
 * offers, and nothing on a page that names a role the kit does not have.
 */
export function validateKit(kit: Kit): string[] {
  const out: string[] = [];
  const roles = new Set<string>();
  const allRoles = new Set(kit.columns.map((c) => c.role));
  for (const c of kit.columns) {
    if (roles.has(c.role)) out.push(`Role '${c.role}' is listed twice.`);
    roles.add(c.role);
    if (!isColumnKind(c.kind) || !isSemantic(c.semantic)) out.push(`Role '${c.role}' has an unknown kind or meaning.`);
    else if (!semanticOf(c.semantic)!.kinds.includes(c.kind)) out.push(`Role '${c.role}': ${c.kind} cannot be the ${c.semantic}.`);
    if (c.aliases.length === 0) out.push(`Role '${c.role}' has no header to match.`);
    if (c.rateParts && (!allRoles.has(c.rateParts.numerator) || !allRoles.has(c.rateParts.denominator))) out.push(`Role '${c.role}': its parts are not roles of the kit.`);
  }
  const figureIds = new Set(kit.figures.map((f) => f.id));
  for (const f of kit.figures) {
    if (roles.has(f.id)) out.push(`Figure '${f.id}' has the same name as a column role.`);
    for (const t of f.terms) if (!roles.has(t)) out.push(`Figure '${f.id}' uses '${t}', which is not a role.`);
  }
  for (const c of kit.checks) {
    if (!checkDef(c.check)) out.push(`Check '${c.id}' is not a known check.`);
    for (const v of Object.values(c.params).flat()) if (typeof v === "string" && !roles.has(v)) out.push(`Check '${c.id}' names '${v}', which is not a role.`);
  }
  for (const t of kit.thresholds) if (!figureIds.has(t.figure) && !roles.has(t.figure)) out.push(`Threshold '${t.id}' is on an unknown figure.`);
  const thresholdIds = new Set(kit.thresholds.map((t) => t.id));
  const pageKeys = new Set<string>();
  for (const p of kit.pages) {
    if (pageKeys.has(p.key)) out.push(`Page '${p.key}' is listed twice.`);
    pageKeys.add(p.key);
    for (const [i, b] of p.blocks.entries()) {
      const at = `Page '${p.key}' block ${i + 1}`;
      if (!KIT_BLOCK_BUILDERS[b.type]) { out.push(`${at}: '${b.type}' is not a kit block.`); continue; }
      if (b.w < 1 || b.w > 12 || b.h < 1 || b.h > 10) out.push(`${at}: size is off the grid.`);
      if (b.family && !visualFamilyDef(b.family)) out.push(`${at}: unknown visual.`);
      for (const [well, fields] of Object.entries(b.wells ?? {})) {
        if (b.family && !visualFamilyDef(b.family)!.wells.some((w) => w.key === well)) out.push(`${at}: the visual has no ${well} well.`);
        for (const f of fields ?? []) if (!roles.has(f.role) && !figureIds.has(f.role)) out.push(`${at}: '${f.role}' is not a role or figure.`);
      }
      for (const f of b.figures ?? []) if (!figureIds.has(f)) out.push(`${at}: unknown figure '${f}'.`);
      for (const t of b.thresholds ?? []) if (!thresholdIds.has(t)) out.push(`${at}: unknown threshold '${t}'.`);
      for (const r of Object.values(b.roles ?? {}).flat()) if (!roles.has(r as string) && !figureIds.has(r as string)) out.push(`${at}: '${String(r)}' is not a role.`);
    }
  }
  for (const r of kit.templateRoles) if (!roles.has(r)) out.push(`The template sheet names '${r}', which is not a role.`);
  if (kit.reviewState !== "UNREVIEWED" && kit.reviewState !== "REVIEWED") out.push("Unknown review state.");
  return [...new Set(out)];
}
