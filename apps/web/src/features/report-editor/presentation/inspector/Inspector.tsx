"use client";

import type { ChartConfig } from "@donordesk/domain/contexts/reporting/chart-config.js";
import { ReportChartPanel } from "@/features/reporting/presentation/ReportChartPanel";
import { CommentsThread } from "@/features/comments/presentation/CommentsThread";
import type { ChartFigureIndicator } from "@/features/reporting/presentation/ChartFigure";
import type { SectionRevision } from "@/lib/actions/reporting";
import type { InspectorPanel } from "../../application/url-state";
import type { ReportCheck } from "../../application/report-checks";
import type { SectionVM } from "../../application/editor-model";
import type { Anchor } from "../../application/claim-anchors";
import { isOpenStatement } from "../../application/statements";
import { StatementsTab, type InspectorClaim, type StatementHandlers } from "./StatementsTab";
import { SourcesTab, type SourceRef } from "./SourcesTab";
import { HistoryTab } from "./HistoryTab";
import { ChecksPanel } from "./ChecksPanel";

type SectionTab = Exclude<InspectorPanel, "checks">;

export type InspectorStatements = {
  claims: InspectorClaim[];
  anchors: ReadonlyMap<string, Anchor | null>;
  focusClaimId?: string;
  canResolve: boolean;
  canCorrect: boolean;
  correctBlockedReason?: string;
  canOverrideConfidential: boolean;
  busyClaimId: string | null;
  rechecking: boolean;
  handlers: StatementHandlers;
};

/**
 * Context for the selected section only (Statements · Sources · Chart ·
 * Comments · History), or the whole-report Checks list when opened from the
 * readiness button.
 */
export function Inspector({
  projectId,
  panel,
  onPanel,
  section,
  sectionData,
  statements,
  checks,
  checkBusyId,
  onCheck,
  chartIndicators,
  canEdit,
  restoringId,
  onRestore,
  onReload,
}: {
  projectId: string;
  panel: InspectorPanel;
  onPanel: (panel: InspectorPanel) => void;
  section: SectionVM | null;
  sectionData: { id: string; updatedAt: string; chartConfig?: ChartConfig | null; sourceReferences?: SourceRef[] } | null;
  statements: InspectorStatements;
  checks: ReportCheck[];
  checkBusyId: string | null;
  onCheck: (check: ReportCheck) => void;
  chartIndicators: ChartFigureIndicator[];
  canEdit: boolean;
  restoringId: string | null;
  onRestore: (revision: SectionRevision) => void;
  onReload: () => void;
}) {
  if (panel === "checks" || !section || !sectionData) {
    return (
      <ChecksPanel
        checks={checks}
        busyId={checkBusyId}
        onCheck={onCheck}
        onBack={section ? () => onPanel("statements") : undefined}
        backLabel={section ? `Back to section ${section.number}` : undefined}
      />
    );
  }

  const openCount = statements.claims.filter(isOpenStatement).length;
  const sourceCount = sectionData.sourceReferences?.length ?? 0;
  const tabs: Array<[SectionTab, string, string]> = [
    ["statements", "Statements", openCount ? ` · ${openCount}` : ""],
    ["sources", "Sources", sourceCount ? ` · ${sourceCount}` : ""],
    ["chart", "Chart", ""],
    ["comments", "Comments", section.commentCount ? ` · ${section.commentCount}` : ""],
    ["history", "History", ""],
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/40">
      <div className="border-b border-slate-200 px-4 pt-4 dark:border-white/10">
        <p className="text-xs text-slate-500 dark:text-slate-400">Section {section.number}</p>
        <h2 className="mb-2 mt-0.5 text-base font-semibold">{section.title}</h2>
        <div
          role="tablist"
          aria-label="Section details"
          className="-mb-px flex overflow-x-auto"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const index = tabs.findIndex(([key]) => key === panel);
            const next = tabs[(index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]![0];
            onPanel(next);
            window.requestAnimationFrame(() => document.getElementById(`inspector-tab-${next}`)?.focus());
          }}
        >
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`inspector-tab-${key}`}
              aria-selected={panel === key}
              aria-controls="inspector-panel"
              tabIndex={panel === key ? 0 : -1}
              onClick={() => onPanel(key)}
              className={`min-h-[40px] whitespace-nowrap border-b-2 px-1.5 py-2 text-[13px] transition ${
                panel === key
                  ? "border-brand-600 font-medium text-brand-700 dark:border-brand-400 dark:text-brand-300"
                  : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {label}
              {count}
            </button>
          ))}
        </div>
      </div>
      <div id="inspector-panel" role="tabpanel" aria-labelledby={`inspector-tab-${panel}`} className="space-y-3 p-4">
        {panel === "statements" && (
          <StatementsTab
            claims={statements.claims}
            anchors={statements.anchors}
            focusClaimId={statements.focusClaimId}
            canResolve={statements.canResolve}
            canCorrect={statements.canCorrect}
            correctBlockedReason={statements.correctBlockedReason}
            canOverrideConfidential={statements.canOverrideConfidential}
            sectionApproved={section.isApproved}
            busyClaimId={statements.busyClaimId}
            rechecking={statements.rechecking}
            handlers={statements.handlers}
          />
        )}
        {panel === "sources" && <SourcesTab projectId={projectId} sources={sectionData.sourceReferences ?? []} />}
        {panel === "chart" && (
          <ReportChartPanel
            key={`chart-${sectionData.id}`}
            sectionId={sectionData.id}
            sectionTitle={section.title}
            initialConfig={sectionData.chartConfig ?? null}
            expectedVersion={sectionData.updatedAt}
            indicators={chartIndicators}
            readOnly={!canEdit || section.isApproved}
            onReload={onReload}
          />
        )}
        {panel === "comments" && <CommentsThread key={`comments-${sectionData.id}`} entityType="report_section" entityId={sectionData.id} heading="Comments" />}
        {panel === "history" && (
          <HistoryTab
            key={`history-${sectionData.id}`}
            sectionId={sectionData.id}
            refreshKey={sectionData.updatedAt}
            canRestore={canEdit && !section.regenerating}
            restoringId={restoringId}
            onRestore={onRestore}
          />
        )}
      </div>
    </div>
  );
}
