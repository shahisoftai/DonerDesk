"use client";

import type { ChartConfig } from "@donordesk/domain/contexts/reporting/chart-config.js";
import { ReportChartPanel } from "@/features/reporting/presentation/ReportChartPanel";
import { CommentsThread } from "@/features/comments/presentation/CommentsThread";
import type { ChartFigureIndicator } from "@/features/reporting/presentation/ChartFigure";
import type { InspectorPanel } from "../../application/url-state";
import type { ReportCheck } from "../../application/report-checks";
import type { SectionVM } from "../../application/editor-model";
import { StatementsTab, type InspectorClaim } from "./StatementsTab";
import { SourcesTab, type SourceRef } from "./SourcesTab";
import { ChecksPanel } from "./ChecksPanel";

type SectionTab = Exclude<InspectorPanel, "checks">;

/**
 * Context for the selected section only (Statements · Sources · Chart ·
 * Comments), or the whole-report Checks list when opened from the readiness
 * button.
 */
export function Inspector({
  projectId,
  panel,
  onPanel,
  section,
  sectionData,
  claims,
  focusClaimId,
  checks,
  onCheck,
  chartIndicators,
  canEdit,
  canResolveClaim,
  canOverrideConfidential,
  onReload,
}: {
  projectId: string;
  panel: InspectorPanel;
  onPanel: (panel: InspectorPanel) => void;
  section: SectionVM | null;
  sectionData: { id: string; updatedAt: string; chartConfig?: ChartConfig | null; sourceReferences?: SourceRef[] } | null;
  claims: InspectorClaim[];
  focusClaimId?: string;
  checks: ReportCheck[];
  onCheck: (check: ReportCheck) => void;
  chartIndicators: ChartFigureIndicator[];
  canEdit: boolean;
  canResolveClaim: boolean;
  canOverrideConfidential: boolean;
  onReload: () => void;
}) {
  if (panel === "checks" || !section || !sectionData) {
    return (
      <ChecksPanel
        checks={checks}
        onCheck={onCheck}
        onBack={section ? () => onPanel("statements") : undefined}
        backLabel={section ? `Back to section ${section.number}` : undefined}
      />
    );
  }

  const openCount = claims.filter((c) => c.verificationResult === "FAILED" && !c.resolvedById).length;
  const sourceCount = sectionData.sourceReferences?.length ?? 0;
  const tabs: Array<[SectionTab, string]> = [
    ["statements", `Statements${openCount ? ` · ${openCount}` : ""}`],
    ["sources", `Sources${sourceCount ? ` · ${sourceCount}` : ""}`],
    ["chart", "Chart"],
    ["comments", "Comments"],
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/40">
      <div className="border-b border-slate-200 px-4 pt-4 dark:border-white/10">
        <p className="text-xs text-slate-500 dark:text-slate-400">Section {section.number}</p>
        <h2 className="mb-2 mt-0.5 text-base font-semibold">{section.title}</h2>
        <div role="tablist" aria-label="Section details" className="-mb-px flex overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`inspector-tab-${key}`}
              aria-selected={panel === key}
              aria-controls="inspector-panel"
              onClick={() => onPanel(key)}
              className={`whitespace-nowrap border-b-2 px-1.5 py-2 text-[13px] transition ${
                panel === key
                  ? "border-brand-600 font-medium text-brand-700 dark:border-brand-400 dark:text-brand-300"
                  : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div id="inspector-panel" role="tabpanel" aria-labelledby={`inspector-tab-${panel}`} className="space-y-3 p-4">
        {panel === "statements" && (
          <StatementsTab
            claims={claims}
            sourceReferences={sectionData.sourceReferences}
            focusClaimId={focusClaimId}
            canResolveClaim={canResolveClaim}
            canOverrideConfidential={canOverrideConfidential}
            onResolved={onReload}
          />
        )}
        {panel === "sources" && <SourcesTab projectId={projectId} sources={sectionData.sourceReferences ?? []} />}
        {panel === "chart" && (
          <ReportChartPanel
            key={`chart-${sectionData.id}`}
            sectionId={sectionData.id}
            initialConfig={sectionData.chartConfig ?? null}
            expectedVersion={sectionData.updatedAt}
            indicators={chartIndicators}
            readOnly={!canEdit || section.isApproved}
            onReload={onReload}
          />
        )}
        {panel === "comments" && <CommentsThread key={`comments-${sectionData.id}`} entityType="report_section" entityId={sectionData.id} heading="Comments" />}
      </div>
    </div>
  );
}
