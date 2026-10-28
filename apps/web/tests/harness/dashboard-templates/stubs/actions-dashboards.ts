// Stand-in for the dashboard-template actions: templates live in memory (the real domain built-ins plus any copy made), and every call is recorded.
import { TEMPLATE_SECTORS } from "@donordesk/domain/contexts/dashboards/dashboard-templates.js";
import { SECTOR_TEMPLATES } from "@donordesk/domain/contexts/dashboards/sector-templates.js";
import type { DashboardTemplate } from "@donordesk/domain/contexts/dashboards/dashboard-templates.js";

type H = { own: Record<string, { template: DashboardTemplate; updatedAt: string }>; saves: Array<{ body: Record<string, unknown>; id?: string }>; applies: Array<{ id: string; input: Record<string, unknown> }>; deletes: string[]; failNext: string | null; n: number };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });
const summary = (t: DashboardTemplate, canEdit: boolean, updatedAt?: string) => ({
  id: t.id, title: t.title, description: t.description, sector: t.sector, sectorLabel: TEMPLATE_SECTORS[t.sector].label, audience: t.audience, origin: t.origin, ...(t.basedOn ? { basedOn: t.basedOn } : {}),
  revision: t.revision, chartCount: t.widgets.filter((w) => w.kind === "CHART").length, roleCount: t.roles.length, ...(updatedAt ? { updatedAt } : {}), canEdit,
});
export async function listDashboardTemplatesAction() { return ok([...Object.values(h().own).map((o) => summary(o.template, true, o.updatedAt)), ...SECTOR_TEMPLATES.map((t) => summary(t, false))]); }
export async function getDashboardTemplateAction(id: string) {
  const own = h().own[id];
  if (own) return ok({ template: own.template as unknown as Record<string, unknown>, updatedAt: own.updatedAt, canEdit: true });
  const b = SECTOR_TEMPLATES.find((t) => t.id === id)!;
  return ok({ template: b as unknown as Record<string, unknown>, canEdit: false });
}
export async function saveDashboardTemplateAction(body: Record<string, unknown>, id?: string) {
  if (h().failNext) { const message = h().failNext!; h().failNext = null; return { ok: false as const, error: { kind: "conflict", message } }; }
  h().saves.push({ body, id });
  const updatedAt = new Date(Date.UTC(2026, 9, 10, 8, 0, ++h().n)).toISOString();
  const tid = id ?? `own${h().n}`;
  const prev = h().own[tid]?.template;
  h().own[tid] = { updatedAt, template: { ...(body as unknown as DashboardTemplate), id: tid, status: "DRAFT", origin: "ORGANISATION", revision: (prev?.revision ?? 0) + 1 } };
  return ok({ id: tid, updatedAt, revision: h().own[tid]!.template.revision });
}
export async function deleteDashboardTemplateAction(id: string) { h().deletes.push(id); delete h().own[id]; return ok(undefined); }
export async function applyDashboardTemplateAction(id: string, input: Record<string, unknown>) {
  h().applies.push({ id, input });
  const m = input.mapping as Record<string, string | null>;
  return ok({ dashboardId: "dash1", updatedAt: "2026-10-10T08:00:00.000Z", chartsLeftOut: Object.values(m).every((v) => v) ? [] : [{ title: "Some chart", missingRoles: ["x"] }] });
}
