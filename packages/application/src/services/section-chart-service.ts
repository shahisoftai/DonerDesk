import type { Result, TenantId } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import { chartsForSection, type ResolvedChartData } from "@donordesk/domain";
import type { GeneratedArtifact, IReportArtifactRepository } from "../ports/reporting.js";

/**
 * The CHART artifacts of a section, derived from the tables in its text: one chart per table that has something to chart,
 * each tied to its table (see `chartsForSection`). Pure, so generation and every later edit produce identical charts.
 */
export function chartArtifactsForSection(section: { title: string; content: string }, firstOrdinal = 0): GeneratedArtifact[] {
  return chartsForSection(section).map((chart, i) => ({
    kind: "CHART" as const,
    caption: chart.caption,
    ordinal: firstOrdinal + i,
    payload: {
      type: chart.type,
      dataBinding: chart.binding,
      ...(chart.unit ? { unit: chart.unit } : {}),
      title: chart.title,
      caption: chart.caption,
      categories: chart.categories,
      series: chart.series.map((s) => ({ name: s.name, data: s.data, sourceReferences: [] })),
      sourceReferences: [],
      tableIndex: chart.tableIndex,
      ...(chart.tableCaption ? { tableCaption: chart.tableCaption } : {}),
      ...(chart.stacked ? { stacked: true } : {}),
      ...(chart.referenceLine ? { referenceLine: chart.referenceLine } : {}),
      ...(chart.truncated ? { truncated: chart.truncated } : {}),
    },
    sourceReferences: [],
  }));
}

export interface ISectionChartService {
  /** Rebuilds the section's charts from its current text, leaving its other artifacts alone. Returns how many charts it has. */
  refresh(input: { tenantId: TenantId; sectionId: string; revisionId: string | null; title: string; content: string }): Promise<Result<number, DomainError>>;
}

export class SectionChartService implements ISectionChartService {
  constructor(private readonly artifacts: IReportArtifactRepository) {}

  async refresh(input: { tenantId: TenantId; sectionId: string; revisionId: string | null; title: string; content: string }): Promise<Result<number, DomainError>> {
    const existing = await this.artifacts.findBySection(input.sectionId, input.tenantId);
    if (!existing.ok) return existing;
    const kept: GeneratedArtifact[] = existing.value
      .filter((a) => a.kind !== "CHART")
      .map((a) => ({ kind: a.kind, caption: a.caption ?? undefined, ordinal: 0, payload: a.payload, sourceReferences: a.sourceReferences }) as GeneratedArtifact);
    const charts = chartArtifactsForSection({ title: input.title, content: input.content });
    const all = [...kept, ...charts].map((a, i) => ({ ...a, ordinal: i }) as GeneratedArtifact);
    const replaced = await this.artifacts.replaceForSection({ tenantId: input.tenantId, sectionId: input.sectionId, revisionId: input.revisionId, artifacts: all });
    if (!replaced.ok) return replaced;
    return { ok: true, value: charts.length };
  }
}

const num = (d: unknown): number | null => (typeof d === "number" && Number.isFinite(d) ? d : null);

/** A stored CHART artifact payload as the dataset the renderers draw; null when it carries nothing drawable. */
export function chartPayloadToResolved(payload: unknown): ResolvedChartData | null {
  const p = payload as Partial<GeneratedChartLike> | null;
  if (!p || !Array.isArray(p.categories) || !Array.isArray(p.series) || p.categories.length === 0) return null;
  return {
    type: p.type ?? "BAR",
    dataBinding: p.dataBinding ?? "INDICATOR_PROGRESS",
    categories: p.categories.map(String),
    series: p.series.map((s) => ({ name: String(s.name), data: (s.data ?? []).map(num) })),
    ...(p.unit ? { unit: p.unit } : {}),
    title: p.title ?? "",
    ...(p.stacked ? { stacked: true } : {}),
    ...(p.referenceLine ? { referenceLine: p.referenceLine } : {}),
    ...(p.truncated ? { truncated: p.truncated } : {}),
  } as ResolvedChartData;
}

interface GeneratedChartLike {
  type: ResolvedChartData["type"];
  dataBinding: ResolvedChartData["dataBinding"];
  unit: string;
  title: string;
  categories: unknown[];
  series: Array<{ name: unknown; data?: unknown[] }>;
  stacked: boolean;
  referenceLine: { name: string; value: number };
  truncated: { shown: number; total: number };
}
