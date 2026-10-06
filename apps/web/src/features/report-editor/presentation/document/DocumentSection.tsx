"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { bindingsForSection, type ChartConfig } from "@donordesk/domain/contexts/reporting/chart-config.js";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { sectionStatusTone } from "@/lib/shared/tone";
import { SECTION_STATUS_LABEL } from "@/lib/labels";
import Link from "next/link";
import { fallbackBannerCopy } from "@/lib/reporting-copy";
import { RECORDED_FIGURES_ONLY_INSTRUCTION } from "@donordesk/domain/contexts/reporting/generation-fallback.js";
import type { ReportArtifact } from "@/lib/server/schemas";
import { SectionArtifacts } from "@/features/reporting/presentation/document-blocks";
import { ChartFigure, type ChartFigureIndicator } from "@/features/reporting/presentation/ChartFigure";
import type { SectionVM } from "../../application/editor-model";
import type { Anchor } from "../../application/claim-anchors";
import type { Highlight, HighlightTone } from "../../application/highlight-hast";
import { statementState } from "../../application/statements";
import type { EditorHighlight } from "../../rich-text/claim-highlights";
import type { RichEditorSaveStatus, RichEditorSaved } from "../../rich-text/RichSectionEditor";
import type { InspectorClaim } from "../inspector/StatementsTab";
import { StaticSectionView } from "./StaticSectionView";
import { AiRewritePanel } from "./AiRewritePanel";
import { RegeneratePopover } from "./RegeneratePopover";
import { EvidencePeek } from "./EvidencePeek";

/** Sub-sections read as sub-headings of their parent in the document. */
const HEADING_SIZE: Record<number, string> = { 1: "text-xl", 2: "text-lg", 3: "text-base", 4: "text-base text-slate-700 dark:text-slate-200" };

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
  generationFallback?: { reason: string; detail?: string | null; action: "RETRY" | "RETRY_RECORDED_FIGURES_ONLY" | "OPEN_SETTINGS" } | null;
};

const PEEK_HIDE_DELAY_MS = 180;

const HIGHLIGHT_LABEL: Record<HighlightTone, string> = {
  open: "Statement that needs a decision",
  kept: "Statement kept with a note",
  "left-out": "Statement left out of the report",
  verified: "Statement that matches the evidence",
};

/**
 * One section of the continuous report document. Read view by default, with
 * checked statements marked where they are; the selected section shows a
 * toolbar (status, AI actions, Re-check, Edit, Approve) and, while editing,
 * the rich-text editor in place of the read view (same typography).
 */
export function DocumentSection({
  projectId,
  vm,
  section,
  artifacts,
  chartIndicators,
  claims,
  anchors,
  verifiedTables,
  focusedClaimId,
  showEvidenceMarks,
  selected,
  editing,
  canEdit,
  canRegenerate,
  approving,
  rechecking,
  regenerationPending,
  onSelect,
  onEdit,
  onDoneEditing,
  onApprove,
  onReload,
  onSaveStatus,
  onSaved,
  onNotice,
  onClaim,
  onRecheck,
  onRegenerate,
}: {
  projectId: string;
  vm: SectionVM;
  section: DocumentSectionData;
  artifacts: ReportArtifact[];
  chartIndicators: ChartFigureIndicator[];
  claims: InspectorClaim[];
  anchors: ReadonlyMap<string, Anchor | null>;
  /** Tables (by index) built from verified data, and those with changed numbers. */
  verifiedTables?: { verified: ReadonlySet<number>; drifted: ReadonlySet<number> };
  focusedClaimId?: string;
  showEvidenceMarks: boolean;
  selected: boolean;
  editing: boolean;
  canEdit: boolean;
  canRegenerate: boolean;
  approving: boolean;
  rechecking: boolean;
  regenerationPending: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDoneEditing: () => void;
  onApprove: () => void;
  /** Refresh from the server and leave edit mode (conflict reload, AI rewrite). */
  onReload: () => void;
  onSaveStatus?: (status: RichEditorSaveStatus) => void;
  onSaved: (saved: RichEditorSaved) => void;
  onNotice?: (message: string) => void;
  onClaim: (claimId: string) => void;
  onRecheck: () => void;
  /** Starts a regeneration; resolves true when it was accepted. */
  onRegenerate: (instruction: string) => Promise<boolean>;
}) {
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [peek, setPeek] = useState<{ claimId: string; element: HTMLElement } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const content = section.content ?? "";

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);
  useEffect(() => {
    if (editing || vm.regenerating) {
      setRewriteOpen(false);
      setRegenerateOpen(false);
    }
  }, [editing, vm.regenerating]);

  const { highlights, editorHighlights } = useMemo(() => {
    const out: Highlight[] = [];
    const inEditor: EditorHighlight[] = [];
    for (const claim of claims) {
      const state = statementState(claim);
      if (state === "minor" || (state === "verified" && !showEvidenceMarks)) continue;
      const tone: HighlightTone = state;
      inEditor.push({ claimId: claim.id, text: claim.text, tone });
      const anchor = anchors.get(claim.id);
      if (anchor) out.push({ claimId: claim.id, start: anchor.start, end: anchor.end, tone, label: `${HIGHLIGHT_LABEL[tone]}: ${claim.text}` });
    }
    return { highlights: out, editorHighlights: inEditor };
  }, [claims, anchors, showEvidenceMarks]);

  function showPeek(claimId: string | null, element: HTMLElement | null) {
    window.clearTimeout(hideTimer.current);
    if (claimId && element) {
      if (peek?.claimId !== claimId || peek.element !== element) setPeek({ claimId, element });
      return;
    }
    hideTimer.current = window.setTimeout(() => setPeek(null), PEEK_HIDE_DELAY_MS);
  }

  const statusLabel = vm.regenerating
    ? "Being rewritten"
    : vm.openStatements > 0 && !vm.isApproved
      ? "Needs a decision"
      : vm.needsRecheck
        ? "Needs a re-check"
        : (SECTION_STATUS_LABEL[vm.status] ?? "Draft");
  const statusTone = vm.regenerating ? "ai" : (vm.openStatements > 0 || vm.needsRecheck) && !vm.isApproved ? "warning" : sectionStatusTone(vm.status);
  const busy = vm.regenerating || regenerationPending;
  const peekClaim = peek ? claims.find((c) => c.id === peek.claimId) : undefined;

  if (vm.isWriting) {
    return (
      <section id={`section-${vm.id}`} aria-busy="true" className="-mx-5 mb-2 scroll-mt-36 rounded-xl px-5 py-4">
        <h2 className={`mb-3 font-semibold text-slate-400 dark:text-slate-500 ${HEADING_SIZE[vm.level] ?? HEADING_SIZE[4]}`}>
          {vm.number} {vm.title}
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
      aria-busy={busy || undefined}
      onClick={selected ? undefined : onSelect}
      className={`-mx-5 mb-2 scroll-mt-36 rounded-xl px-5 py-4 transition ${
        selected ? "bg-brand-50/60 ring-1 ring-brand-200 dark:bg-brand-500/5 dark:ring-brand-500/30" : "hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
      }`}
    >
      {selected && (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label={`Section ${vm.number} actions`}>
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <div className="flex-1" />
          {canEdit && !editing && !busy && content.trim() && (
            <Button size="sm" variant="ghost" onClick={() => setRewriteOpen((v) => !v)} aria-expanded={rewriteOpen}>
              Rewrite with AI
            </Button>
          )}
          {canRegenerate && !editing && !busy && (
            <Button size="sm" variant="ghost" onClick={() => setRegenerateOpen((v) => !v)} aria-expanded={regenerateOpen}>
              Regenerate
            </Button>
          )}
          {canEdit && vm.needsRecheck && !editing && !busy && (
            <Button size="sm" variant="secondary" onClick={onRecheck} pending={rechecking}>
              Re-check
            </Button>
          )}
          {canEdit && !editing && !busy && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onEdit}
              title={vm.isApproved ? "Saving a change reopens this section for review" : undefined}
            >
              {vm.isApproved ? "Edit (reopens section)" : "Edit"}
            </Button>
          )}
          {!vm.isApproved && vm.canApprove && !editing && (
            <Button size="sm" onClick={onApprove} pending={approving}>
              Approve section
            </Button>
          )}
          {!vm.isApproved && !vm.canApprove && vm.approveBlockedReason && canEdit && !editing && (
            <span className="w-full text-xs text-warning-700 dark:text-warning-400 sm:w-auto">{vm.approveBlockedReason}</span>
          )}
        </div>
      )}

      <h2 id={`section-heading-${vm.id}`} className={`mb-3 font-semibold leading-snug ${HEADING_SIZE[vm.level] ?? HEADING_SIZE[4]}`}>
        <button type="button" onClick={onSelect} className="rounded text-left hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:text-brand-300">
          {vm.number} {vm.title}
        </button>
      </h2>

      {section.generatedWithAi === false && content.trim() && !busy && (
        <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning-500/30 bg-warning-50 px-3 py-2 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          {section.generationFallback ? (
            <FallbackBannerBody
              fallback={section.generationFallback}
              canRegenerate={canRegenerate}
              onRetry={() => void onRegenerate("")}
              onRetryRecordedOnly={() => void onRegenerate(RECORDED_FIGURES_ONLY_INSTRUCTION)}
            />
          ) : (
            <>
              <span>Written without AI: this text was written by hand, or by an earlier version that did not record why. Check the wording.</span>
              {canRegenerate && (
                <Button size="sm" variant="secondary" onClick={() => setRegenerateOpen(true)}>
                  Try AI again
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {vm.summaryStale && !busy && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <span>May be out of date — other sections changed after this summary was written.</span>
          {canRegenerate && (
            <Button size="sm" variant="secondary" pending={regenerationPending} onClick={() => void onRegenerate("")}>
              Regenerate summary
            </Button>
          )}
        </div>
      )}

      {regenerateOpen && selected && canRegenerate && !busy && (
        <RegeneratePopover
          sectionTitle={vm.title}
          isApproved={vm.isApproved}
          pending={regenerationPending}
          onClose={() => setRegenerateOpen(false)}
          onRegenerate={(instruction) => {
            void onRegenerate(instruction).then((started) => {
              if (started) setRegenerateOpen(false);
            });
          }}
        />
      )}

      {rewriteOpen && selected && canEdit && !busy && (
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
          highlights={editorHighlights}
          canAskAi={canEdit}
          onReload={onReload}
          onStatusChange={onSaveStatus}
          onSaved={onSaved}
          onDone={onDoneEditing}
        />
      ) : (
        <div className="relative">
          <div className={busy ? "opacity-50" : undefined}>
            <StaticSectionView
              content={content}
              highlights={highlights}
              focusedClaimId={focusedClaimId}
              verifiedTables={verifiedTables}
              onClaim={onClaim}
              onPeek={showPeek}
            />
          </div>
          {busy && (
            <div role="status" aria-live="polite" className="absolute inset-0 flex items-start justify-center pt-6">
              <span className="flex items-center gap-2 rounded-full border border-ai-500/30 bg-white px-3 py-1.5 font-sans text-sm font-medium text-ai-700 shadow-sm dark:bg-slate-900 dark:text-ai-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-ai-500" aria-hidden="true" />
                Regenerating… your current text stays until the new text is ready
              </span>
            </div>
          )}
        </div>
      )}

      {peek && peekClaim && !editing && (
        <EvidencePeek claim={peekClaim} anchor={peek.element} projectId={projectId} onHoverChange={(hovering) => showPeek(hovering ? peek.claimId : null, hovering ? peek.element : null)} />
      )}

      {section.chartConfig && !editing && bindingsForSection(section.sectionTitle).includes(section.chartConfig.dataBinding) && (
        <ChartFigure config={section.chartConfig} indicators={chartIndicators} caption={`Figure · ${vm.title}`} />
      )}
      {!editing && <SectionArtifacts artifacts={artifacts} contentHasTable={/^\s*\|.*\|\s*$/m.test(content)} />}
    </section>
  );
}

function FallbackBannerBody({
  fallback,
  canRegenerate,
  onRetry,
  onRetryRecordedOnly,
}: {
  fallback: NonNullable<DocumentSectionData["generationFallback"]>;
  canRegenerate: boolean;
  onRetry: () => void;
  onRetryRecordedOnly: () => void;
}) {
  const banner = fallbackBannerCopy(fallback);
  return (
    <>
      <span>Written without AI. {banner.message} Check the wording before you approve it.</span>
      {banner.action === "OPEN_SETTINGS" ? (
        <Link href="/settings" className="text-sm font-medium underline">
          {banner.actionLabel}
        </Link>
      ) : (
        canRegenerate && (
          <Button size="sm" variant="secondary" onClick={banner.action === "RETRY" ? onRetry : onRetryRecordedOnly}>
            {banner.actionLabel}
          </Button>
        )
      )}
    </>
  );
}
