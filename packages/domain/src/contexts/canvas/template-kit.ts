/** The small helpers every starter canvas is written with (Phase 45.7), shared with the templates built from the sector library (Phase 46). */
import type { BlockInstance, CanvasPage } from "./canvas.js";
import type { TemplateRole } from "./template.js";

/** The one house style every starter uses, so a dashboard and an infographic made from the same starter look alike. */
export const HOUSE_THEME = "HUMANITARIAN_BLUE";
export type At = [x: number, y: number, w: number, h: number];
export const block = (id: string, kind: string, [x, y, w, h]: At, props: unknown): BlockInstance => ({ id, kind, bounds: { x, y, w, h }, props, bindings: [] });
export const page = (blocks: BlockInstance[], format = "WEB_FLUID"): CanvasPage[] => [{ id: "page-1", title: "Page 1", format, blocks }];
export const role = (key: string, label: string, required = false): TemplateRole => ({ key, label, required, accepts: "INDICATOR" });
export const kpi = (id: string, at: At, key: string) => block(id, "KPI", at, { indicatorId: `{{role:${key}}}`, includeDraft: false });
export const chart = (id: string, at: At, key: string, kind: string, title: string) => block(id, "CHART", at, { spec: { version: 2, kind, title, dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: [`{{role:${key}}}`], measure: "PERIOD", showTarget: true, includeDraft: false } } });
export const fig = (label: string, source: string) => ({ label, source });

