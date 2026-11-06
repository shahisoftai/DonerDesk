// Stand-in for the server actions. Datasets are computed with the REAL domain resolver from the fixture sheet, so what the studio draws
// is what the real data path would give; saving keeps charts in memory and records what was sent.
import { resolveDataset } from "@donordesk/domain/contexts/reporting/dataset-query.js";

interface Saved { id: string; name: string; scope: string; projectId: string; mine: boolean; canEdit: boolean; spec: Record<string, unknown>; updatedAt: string }
type Version = { at: string; name: string; spec: Record<string, unknown> };
type H = { sheet: Parameters<typeof resolveDataset>[0]; versions: Record<string, Version[]>; saved: Saved[]; saves: unknown[]; deletes: string[]; failNext: string | null; queries: unknown[]; n: number };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });

export async function resolveChartDatasetAction(_projectId: string, query: unknown) {
  h().queries.push(query);
  const q = query as Parameters<typeof resolveDataset>[1];
  const extras = (window as unknown as { __extras: Record<string, unknown> }).__extras;
  const wanted = new Set(q.sources ?? []);
  return ok({
    key: "chart",
    dataset: { ...resolveDataset(h().sheet, q), ...(wanted.has("PLAN") ? { plan: extras.plan } : {}), ...(wanted.has("ACTIVITY_DAYS") ? { activityDays: extras.activityDays } : {}), ...(wanted.has("BUDGET") ? { budget: extras.budget } : {}), ...(wanted.has("PLACES") ? { places: extras.places } : {}) },
  });
}
export async function listSavedChartsAction() { return ok([...h().saved]); }
export async function saveChartAction(input: { name: string; scope: string; projectId: string; spec: Record<string, unknown>; expectedUpdatedAt?: string }, chartId?: string) {
  if (h().failNext) { const message = h().failNext!; h().failNext = null; return { ok: false as const, error: { kind: "conflict", message } }; }
  h().saves.push({ input, chartId });
  const updatedAt = new Date(Date.UTC(2026, 9, 10, 8, 0, ++h().n)).toISOString();
  if (chartId) {
    const c = h().saved.find((x) => x.id === chartId)!;
    if (c.name !== input.name || JSON.stringify(c.spec) !== JSON.stringify(input.spec)) h().versions[chartId] = [{ at: updatedAt, name: c.name, spec: c.spec }, ...(h().versions[chartId] ?? [])].slice(0, 10);
    Object.assign(c, { name: input.name, spec: input.spec, updatedAt });
    return ok({ id: chartId, updatedAt });
  }
  const id = `c${h().n}`;
  h().saved.unshift({ id, name: input.name, scope: input.scope, projectId: input.projectId, mine: true, canEdit: true, spec: input.spec, updatedAt });
  return ok({ id, updatedAt });
}
export async function deleteChartAction(id: string) { h().deletes.push(id); h().saved = h().saved.filter((c) => c.id !== id); return ok(undefined); }
export async function getSavedChartAction(id: string) { const c = h().saved.find((x) => x.id === id)!; return ok({ ...c, versions: h().versions[id] ?? [] }); }
