/**
 * Canvas templates (Phase 45.7): a canvas whose blocks may name roles instead of indicators. `{{role:KEY}}` anywhere in a block's
 * settings is replaced by the person's choice; a template with an unchosen role is never applied with a guessed value.
 */
import { definitionFor } from "./blocks/registry.js";
import type { Canvas, CanvasPage } from "./canvas.js";

export const TEMPLATE_FAMILIES = ["SNAPSHOT", "AT_A_GLANCE", "FUNDING", "SECTOR_RESULTS", "THREE_W", "BENEFICIARIES", "FLASH", "DONOR", "POSTER", "FACTSHEET", "SOCIAL", "SLIDES", "RESULTS_CHAIN", "PORTFOLIO", "MANAGEMENT", "FIELD", "DATA_QUALITY", "FINANCE", "ME_REVIEW"] as const;
export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];
export interface TemplateRole { key: string; label: string; required: boolean; accepts: "INDICATOR" | "PLACE" | "TEXT" }
export interface CanvasTemplate {
  id: string; title: string; description: string; family: TemplateFamily; origin: "BUILT_IN" | "ORGANISATION"; basedOn?: string;
  revision: number; roles: TemplateRole[];
  canvas: Pick<Canvas, "profile" | "mode" | "language" | "themeId"> & { pages: CanvasPage[] };
}

const ROLE = /\{\{role:([A-Za-z0-9_]+)\}\}/g;
export function rolesUsed(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === "string") for (const m of value.matchAll(ROLE)) into.add(m[1]!);
  else if (Array.isArray(value)) value.forEach((v) => rolesUsed(v, into));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => rolesUsed(v, into));
  return into;
}

function fill(value: unknown, map: Readonly<Record<string, string>>): unknown {
  if (typeof value === "string") return value.replace(ROLE, (_, k: string) => map[k] ?? "");
  if (Array.isArray(value)) return value.map((v) => fill(v, map));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, map)]));
  return value;
}

export function canvasTemplateProblems(t: CanvasTemplate): string[] {
  const out: string[] = [];
  const declared = new Set(t.roles.map((r) => r.key));
  if (declared.size !== t.roles.length) out.push("Two roles share a key.");
  const used = new Set<string>();
  t.canvas.pages.forEach((p) => p.blocks.forEach((b) => rolesUsed([b.props, b.bindings], used)));
  for (const k of used) if (!declared.has(k)) out.push(`A block uses a role called "${k}" that the template does not declare.`);
  return out;
}

export type ApplyResult = { ok: true; canvas: Canvas; leftOut: string[] } | { ok: false; needs: string[] };
/** Applies a template. A block whose required role is unchosen is left out and named; with a required role missing everywhere the apply is refused. */
export function applyCanvasTemplate(t: CanvasTemplate, mapping: Readonly<Record<string, string>>, input: { id: string; title: string; scope: Canvas["scope"]; /** The project the blocks read; a template stores none, the person chooses it. */ projectId?: string }): ApplyResult {
  const missing = t.roles.filter((r) => r.required && !mapping[r.key]).map((r) => r.key);
  if (missing.length > 0) return { ok: false, needs: missing };
  const leftOut: string[] = [];
  const pages = t.canvas.pages.map((p) => ({ ...structuredClone(p), blocks: p.blocks.flatMap((b) => {
    const needed = [...rolesUsed([b.props, b.bindings])];
    if (needed.some((k) => !mapping[k])) { leftOut.push(b.id); return []; }
    const bindings = fill(b.bindings, mapping) as typeof b.bindings;
    const needsProject = definitionFor(b.kind)?.slots.some((slot) => slot.slot === "project") === true && !bindings.some((x) => x.type === "PROJECT");
    return [{ ...structuredClone(b), props: fill(b.props, mapping), bindings: needsProject && input.projectId ? [...bindings, { type: "PROJECT" as const, slot: "project", projectId: input.projectId }] : bindings }];
  }) }));
  return { ok: true, leftOut, canvas: { id: input.id, scope: input.scope, title: input.title, mode: t.canvas.mode, profile: t.canvas.profile, language: t.canvas.language, themeId: t.canvas.themeId, pages, revision: 1 } };
}

/** An organisation's copy of a template; built-ins are never changed in place. */
export const copyCanvasTemplate = (t: CanvasTemplate, id: string): CanvasTemplate => ({ ...structuredClone(t), id, origin: "ORGANISATION", basedOn: t.id, revision: 1 });
