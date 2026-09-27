"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ChartConfig } from "@donordesk/domain/contexts/reporting/chart-config.js";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { sectionStatusTone } from "@/lib/shared/tone";
import { SECTION_STATUS_LABEL } from "@/lib/labels";
import type { ReportArtifact } from "@/lib/server/schemas";
import { SectionArtifacts } from "@/features/reporting/presentation/document-blocks";
import { ChartFigure, type ChartFigureIndicator } from "@/features/reporting/presentation/ChartFigure";
import type { SectionVM } from "../../application/editor-model";
import { StaticSectionView } from "./StaticSectionView";
import { AiRewritePanel } from "./AiRewritePanel";
import type { RichEditorSaveStatus } from "../../rich-text/RichSectionEditor";

// The editor chunk (TipTap/ProseMirror) only downloads when someone edits.
const RichSectionEditor = dynamic(() => import("../../rich-text/RichSectionEditor"), {
  ssr: false,
  loading: () => <div className="min-h-[6rem] animate-pulse rounded-lg bg-slate-50 dark:bg-white/5" aria-busy="true" />,
});

export type DocumentSectionData = {
  id: string;
  sectionTitle: string;
  content?: string;
  status: string;
  updatedAt: string;
  chartConfig?: ChartConfig | null;
  generatedWithAi?: boolean | null;
};

/**
 * One section of the continuous report document. Read view by default; the
 * selected section shows a small toolbar (status, Edit, Approve) and, while
 * editing, the rich-text editor in place of the read view (same typography).
 */
export function DocumentSection({
  vm,
  section,
  artifacts,
  chartIndicators,
  selected,
  editing,
  canEdit,
  approving,
  onSelect,
  onEdit,
  onDoneEditing,
  onApprove,
  onReload,
  onSaveStatus,
  onNotice,
}: {
  vm: SectionVM;
  section: DocumentSectionData;
  artifacts: ReportArtifact[];
  chartIndicators: ChartFigureIndicator[];
  selected: boolean;
  editing: boolean;
  canEdit: boolean;
  approving: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDoneEditing: () => void;
  onApprove: () => void;
  /** Refresh from the server and leave edit mode (conflict reload, AI rewrite). */
  onReload: () => void;
  onSaveStatus?: (status: RichEditorSaveStatus) => void;
  onNotice?: (message: string) => void;
}) {
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const content = section.content ?? "";
  const statusLabel = vm.openStatements > 0 && !vm.isApproved ? "Needs a decision" : (SECTION_STATUS_LABEL[vm.status] ?? "Draft");
  const statusTone = vm.openStatements > 0 && !vm.isApproved ? "warning" : sectionStatusTone(vm.status);

  if (vm.isWriting) {
    return (
      <section id={`section-${vm.id}`} aria-busy="true" className="-mx-5 mb-2 scroll-mt-36 rounded-xl px-5 py-4">
        <h2 className="mb-3 text-xl font-semibold text-slate-400 dark:text-slate-500">
          {vm.number}. {vm.title}
        </h2>
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-white/5" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100 dark:bg-white/5" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-white/5" />
        </div>
        <p className="sr-only">This section is being written.</p>
      </section>
    );
  }

  return (
    <section
      id={`section-${vm.id}`}
      aria-labelledby={`section-heading-${vm.id}`}
      onClick={selected ? undefined : onSelect}
      className={`-mx-5 mb-2 scroll-mt-36 rounded-xl px-5 py-4 transition ${
        selected ? "bg-brand-50/60 ring-1 ring-brand-200 dark:bg-brand-500/5 dark:ring-brand-500/30" : "hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
      }`}
    >
      {selected && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <div className="flex-1" />
          {canEdit && !vm.isApproved && content.trim() && (
            <Button size="sm" variant="ghost" onClick={() => setRewriteOpen((v) => !v)} aria-expanded={rewriteOpen}>
              Rewrite with AI
            </Button>
          )}
          {canEdit && !vm.isApproved && !editing && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          {!vm.isApproved && vm.canApprove && !editing && (
            <Button size="sm" onClick={onApprove} pending={approving}>
              Approve section
            </Button>
          )}
          {!vm.isApproved && !vm.canApprove && vm.approveBlockedReason && canEdit && (
            <span className="text-xs text-warning-700 dark:text-warning-500">{vm.approveBlockedReason}</span>
          )}
        </div>
      )}

      <h2 id={`section-heading-${vm.id}`} className="mb-3 text-xl font-semibold leading-snug">
        <button type="button" onClick={onSelect} className="rounded text-left hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:text-brand-300">
          {vm.number}. {vm.title}
        </button>
      </h2>

      {section.generatedWithAi === false && content.trim() && (
        <p className="mb-3 rounded-lg border border-warning-500/30 bg-warning-50 px-3 py-2 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-500">
          Written without AI — the AI service was unavailable or this section was written by hand. Please check the wording.
        </p>
      )}

      {rewriteOpen && selected && canEdit && (
        <AiRewritePanel
          sectionId={section.id}
          onClose={() => setRewriteOpen(false)}
          onApplied={(notice) => {
            setRewriteOpen(false);
            if (notice) onNotice?.(notice);
            onReload();
          }}
        />
      )}

      {editing ? (
        <RichSectionEditor
          key={section.id}
          sectionId={section.id}
          title={vm.title}
          initialContent={content}
          initialVersion={section.updatedAt}
          onReload={onReload}
          onStatusChange={onSaveStatus}
          onDone={onDoneEditing}
        />
      ) : (
        <StaticSectionView content={content} />
      )}

      {section.chartConfig && !editing && (
        <ChartFigure config={section.chartConfig} indicators={chartIndicators} caption={`Figure · ${vm.title}`} />
      )}
      {!editing && <SectionArtifacts artifacts={artifacts} contentHasTable={/^\s*\|.*\|\s*$/m.test(content)} />}
    </section>
  );
}
