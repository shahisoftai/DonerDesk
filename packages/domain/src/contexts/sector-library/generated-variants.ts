/**
 * More starter canvases for every sector (Phase 48.16): a donor one-pager, a flash update and a monitoring page, each built from the
 * sector's headline indicators like the results canvas. They name roles, never indicators or figures, and write no text of their own, so
 * nothing unwritten can be published by accident. A sector with fewer than four headline indicators gets none of them.
 */
import type { CanvasTemplate } from "../canvas/template.js";
import { block, chart, fig, kpi, page, role as canvasRole } from "../canvas/template-kit.js";
import { SECTOR_REGISTRY } from "./sectors.js";
import { canvasTemplateIdFor, headlineIndicators } from "./headline.js";
import type { LibraryIndicator, SectorContent } from "./model.js";

const base = { origin: "BUILT_IN" as const, revision: 1 };
type Four = [LibraryIndicator, LibraryIndicator, LibraryIndicator, LibraryIndicator];

const fourOf = (c: SectorContent): Four | null => {
  const head = headlineIndicators(c);
  return head.length < 4 ? null : (head.slice(0, 4) as Four);
};
const rolesOf = (head: ReadonlyArray<LibraryIndicator>, required = 1) => head.map((h, i) => canvasRole(h.roleKey!, h.name, i < required));
const ref = (e: LibraryIndicator): string => `{{role:${e.roleKey}}}`;

export function donorVariant(c: SectorContent): CanvasTemplate | null {
  const head = fourOf(c);
  if (!head) return null;
  const [a, b] = head;
  const def = SECTOR_REGISTRY[c.sectorId];
  return {
    ...base, id: `${canvasTemplateIdFor(c.sectorId)}-donor`, title: `${def.label}: donor one-pager`, family: "DONOR",
    description: `A page for a donor on ${def.label.toLowerCase()}: the headline figures, one chart, the story in the people's own words, and where every figure comes from.`,
    roles: rolesOf([a, b]),
    canvas: { profile: "DONOR_REPORT", mode: "PUBLISHED_ONLY", language: "en", themeId: "DEFAULT", pages: page([
      block("banner", "BANNER", [0, 0, 12, 1], {}),
      block("nums", "BIG_NUMBERS", [0, 1, 12, 2], { numbers: [fig("People reached", "REACH_UNIQUE"), { label: a.name.slice(0, 60), source: "INDICATOR", indicatorId: ref(a) }, { label: b.name.slice(0, 60), source: "INDICATOR", indicatorId: ref(b) }] }),
      block("msgs", "KEY_MESSAGES", [0, 3, 6, 4], {}),
      Object.assign(chart("trend", [6, 3, 6, 4], a.roleKey!, "BAR", "Progress over time"), { alt: "" }),
      block("quote", "QUOTE", [0, 7, 12, 3], {}),
      block("notes", "LEGEND_NOTES", [0, 10, 12, 2], {}),
    ], "A4_PORTRAIT") },
  };
}

export function flashVariant(c: SectorContent): CanvasTemplate | null {
  const head = fourOf(c);
  if (!head) return null;
  const [a, b, d] = head;
  const def = SECTOR_REGISTRY[c.sectorId];
  return {
    ...base, id: `${canvasTemplateIdFor(c.sectorId)}-flash`, title: `${def.label}: flash update`, family: "FLASH",
    description: `A one-page update on ${def.label.toLowerCase()}: headline figures, who was reached, what changed, and who is doing what where.`,
    roles: rolesOf([a, b, d]),
    canvas: { profile: "SNAPSHOT", mode: "LIVE", language: "en", themeId: "DEFAULT", pages: page([
      block("banner", "BANNER", [0, 0, 12, 1], {}),
      block("people", "BIG_NUMBERS", [0, 1, 12, 2], { numbers: [fig("People reached", "REACH_UNIQUE"), fig("Activities done", "ACTIVITIES_DONE"), fig("Activities planned", "ACTIVITIES_PLANNED")] }),
      kpi("k1", [0, 3, 4, 2], a.roleKey!), kpi("k2", [4, 3, 4, 2], b.roleKey!), kpi("k3", [8, 3, 4, 2], d.roleKey!),
      block("who", "DEMOGRAPHICS", [0, 5, 6, 4], {}), block("where", "REACH", [6, 5, 6, 4], {}),
      block("msgs", "KEY_MESSAGES", [0, 9, 12, 3], { title: "What changed" }),
      block("w3", "THREE_W", [0, 12, 12, 4], { title: "Who does what, where" }),
      block("notes", "LEGEND_NOTES", [0, 16, 12, 2], {}),
    ]) },
  };
}

export function monitoringVariant(c: SectorContent): CanvasTemplate | null {
  const head = fourOf(c);
  if (!head) return null;
  const [a, b, d, e] = head;
  const def = SECTOR_REGISTRY[c.sectorId];
  return {
    ...base, id: `${canvasTemplateIdFor(c.sectorId)}-monitoring`, title: `${def.label}: monitoring page`, family: "AT_A_GLANCE",
    description: `The headline ${def.label.toLowerCase()} indicators with two trends, progress to target and where the work reaches.`,
    roles: rolesOf(head),
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: "DEFAULT", pages: page([
      kpi("k1", [0, 0, 3, 2], a.roleKey!), kpi("k2", [3, 0, 3, 2], b.roleKey!), kpi("k3", [6, 0, 3, 2], d.roleKey!), kpi("k4", [9, 0, 3, 2], e.roleKey!),
      chart("t1", [0, 2, 6, 4], a.roleKey!, a.kind === "COUNT" ? "LINE" : "BAR", a.name),
      chart("t2", [6, 2, 6, 4], b.roleKey!, b.kind === "COUNT" ? "LINE" : "BAR", b.name),
      block("rings", "PROGRESS_RINGS", [0, 6, 6, 4], { indicatorIds: [ref(a), ref(b), ref(d)], title: "Progress to target" }),
      block("reach", "REACH", [6, 6, 6, 4], {}),
    ]) },
  };
}

export function peopleVariant(c: SectorContent): CanvasTemplate | null {
  const head = fourOf(c);
  if (!head) return null;
  const [a] = head;
  const def = SECTOR_REGISTRY[c.sectorId];
  return {
    ...base, id: `${canvasTemplateIdFor(c.sectorId)}-people`, title: `${def.label}: people reached`, family: "BENEFICIARIES",
    description: `Who the ${def.label.toLowerCase()} work reached: the total, the breakdown by sex and age, where, and one headline indicator.`,
    roles: rolesOf([a]),
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: "DEFAULT", pages: page([
      block("nums", "BIG_NUMBERS", [0, 0, 12, 2], { numbers: [fig("People reached (unique)", "REACH_UNIQUE"), fig("People registered", "REACH_REGISTERED")] }),
      kpi("k1", [0, 2, 4, 2], a.roleKey!),
      block("demo", "DEMOGRAPHICS", [4, 2, 8, 4], {}),
      block("reach", "REACH", [0, 6, 6, 4], {}), block("acts", "ACTIVITIES_BY_LOCATION", [6, 6, 6, 4], {}),
    ]) },
  };
}

export function whereVariant(c: SectorContent): CanvasTemplate | null {
  const head = fourOf(c);
  if (!head) return null;
  const [a, b] = head;
  const def = SECTOR_REGISTRY[c.sectorId];
  return {
    ...base, id: `${canvasTemplateIdFor(c.sectorId)}-where`, title: `${def.label}: where we work`, family: "THREE_W",
    description: `Coverage of the ${def.label.toLowerCase()} work by place: who does what where, where the activities are, and two headline indicators.`,
    roles: rolesOf([a, b]),
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: "DEFAULT", pages: page([
      kpi("k1", [0, 0, 6, 2], a.roleKey!), kpi("k2", [6, 0, 6, 2], b.roleKey!),
      block("w3", "THREE_W", [0, 2, 12, 4], { title: "Who does what, where" }),
      block("map", "MAP", [0, 6, 7, 6], { view: "ACTIVITIES", title: "Where the activities are" }),
      block("acts", "ACTIVITIES_BY_LOCATION", [7, 6, 5, 6], {}),
    ]) },
  };
}

const present = <T>(x: T | null): x is T => x !== null;
export const variantsOf = (c: SectorContent): CanvasTemplate[] => [donorVariant(c), flashVariant(c), monitoringVariant(c), peopleVariant(c), whereVariant(c)].filter(present);
