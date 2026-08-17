"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateDraftAction, detectMissingAction, submitReportForReviewAction, approveReportSectionAction } from "@/lib/actions/reporting";
import { useActionState } from "@/lib/client/action-state";
import { can, type Capability } from "@/lib/shared/capabilities";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { ReadinessGauge } from "@/components/data/ReadinessGauge";
import { SourceReferenceList } from "@/components/editor/SourceReferenceList";
import {
  severityTone,
  sectionStatusTone,
  reportDraftStatusTone,
} from "@/lib/shared/tone";
import { SECTION_STATUS_LABEL, REPORT_DRAFT_STATUS_LABEL } from "@/lib/labels";
import { SectionEditor } from "./SectionEditor";
import { ReviewAndApproval } from "@/features/review/presentation/ReviewAndApproval";
import { ExportsPanel, type ExportHistoryItem } from "@/features/exports/presentation/ExportsPanel";
import { CommentsThread } from "@/features/comments/presentation/CommentsThread";

type Readiness = {
  overall: number;
  sectionsScore: number;
  indicatorsScore: number;
  evidenceScore: number;
  checklistScore: number;
  approvalScore: number;
};
type ChecklistItem = {
  id: string;
  type: string;
  title: string;
  severity: string;
  status: string;
  dueDate?: string | null;
};
type ReportSection = {
  id: string;
  sectionTitle: string;
  content?: string;
  sourceReferences?: Array<{ type: string; id: string; label?: string }>;
  unsupportedClaims?: string[];
  status: string;
  updatedAt: string;
};
type ReportDraft = {
  id: string;
  title: string;
  status: string;
  version: number;
  generatedByAi?: boolean;
};

type Panel = "sections" | "editor" | "context";

export function ReportWorkspace({
  projectId,
  periodId,
  draft,
  sections,
  readiness,
  checklist,
  exports,
  unverifiedIndicatorCount,
  sensitiveEvidenceCount,
  capabilities,
}: {
  projectId: string;
  periodId: string;
  draft: ReportDraft | null;
  sections: ReportSection[];
  readiness: Readiness;
  checklist: ChecklistItem[];
  exports: ExportHistoryItem[];
  unverifiedIndicatorCount: number;
  sensitiveEvidenceCount: number;
  capabilities: readonly Capability[];
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("editor");
  const [draftMsg, setDraftMsg] = useState<string | null>(null);

  const canGenerate = can(capabilities, "report.generate");
  const canEdit = can(capabilities, "reporting.edit");
  const canApproveSection = can(capabilities, "report.approve");

  async function approveSection(sectionId: string) {
    setBusyAction("section");
    try {
      const result = await actionState.run(() => approveReportSectionAction(sectionId));
      if (result !== undefined) router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    if (sections.length === 0) {
      setSelectedId(null);
    } else if (!sections.some((s) => s.id === selectedId)) {
      setSelectedId(sections[0]!.id);
    }
  }, [sections, selectedId]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;
  const openChecklist = checklist.filter((c) => c.status !== "RESOLVED" && c.status !== "ACCEPTED_RISK" && c.status !== "NOT_APPLICABLE");
  const aiEnabledLabel = draft ? (draft.generatedByAi ? "AI-assisted draft" : "Manually created draft") : null;

  async function generate() {
    setBusyAction("draft");
    setDraftMsg(null);
    try {
      const result = await actionState.run(() => generateDraftAction(periodId));
      if (result) {
        setDraftMsg(`Draft generated with ${result.sectionIds.length} sections.`);
        router.refresh();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function detectMissing() {
    setBusyAction("detect");
    try {
      const result = await actionState.run(() => detectMissingAction(periodId));
      if (result !== undefined) router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function submitReview() {
    if (!draft) return;
    setBusyAction("submit");
    try {
      const result = await actionState.run(() => submitReportForReviewAction(draft.id));
      if (result !== undefined) router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{draft ? draft.title : "No report draft yet"}</h2>
          {draft && (
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={reportDraftStatusTone(draft.status)}>
                {REPORT_DRAFT_STATUS_LABEL[draft.status] ?? draft.status.replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400">Version {draft.version}</span>
              {aiEnabledLabel && <span className="text-xs text-slate-500 dark:text-slate-400">· {aiEnabledLabel}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <Button size="sm" variant="secondary" disabled={busyAction === "draft"} onClick={generate}>
              {busyAction === "draft" ? "Generating…" : draft ? "Regenerate AI draft" : "Generate AI draft"}
            </Button>
          )}
          {canGenerate && (
            <Button size="sm" variant="secondary" disabled={busyAction === "detect"} onClick={detectMissing}>
              {busyAction === "detect" ? "Scanning…" : "Run compliance check"}
            </Button>
          )}
          {draft && draft.status === "DRAFT" && canEdit && (
            <Button size="sm" disabled={busyAction === "submit"} onClick={submitReview}>
              Submit for review
            </Button>
          )}
        </div>
      </div>

      {draftMsg && <p className="text-sm text-success-700 dark:text-success-400">{draftMsg}</p>}
      {actionState.error && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}

      {/* Mobile panel switcher */}
      <div className="flex gap-1 border-b border-slate-200 pb-2 text-sm dark:border-white/10 lg:hidden" role="tablist" aria-label="Workspace panels">
        {(
          [
            ["sections", "Sections"],
            ["editor", "Editor"],
            ["context", "Context"],
          ] as Array<[Panel, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={panel === key}
            onClick={() => setPanel(key)}
            className={`rounded-md px-3 py-1.5 ${panel === key ? "bg-brand-500/10 font-semibold text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr_260px]">
        {/* Left: section navigation */}
        <aside className={`space-y-2 ${panel === "sections" ? "block" : "hidden lg:block"}`}>
          {sections.length === 0 && (
            <div className="card text-sm text-slate-600 dark:text-slate-300">
              <p>No sections yet. Generate a draft to create the report structure.</p>
            </div>
          )}
          <nav aria-label="Report sections" className="space-y-1.5">
            {sections.map((s, index) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedId(s.id);
                  setPanel("editor");
                }}
                aria-current={selectedId === s.id ? "true" : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedId === s.id
                    ? "border-brand-500/40 bg-brand-500/5 text-brand-700 dark:text-brand-300"
                    : "border-slate-200 hover:border-brand-400/40 dark:border-white/10"
                }`}
              >
                <span className="truncate">{index + 1}. {s.sectionTitle}</span>
                <Badge tone={sectionStatusTone(s.status)}>{SECTION_STATUS_LABEL[s.status] ?? s.status.replace(/_/g, " ")}</Badge>
              </button>
            ))}
          </nav>
        </aside>

        {/* Center: editor */}
        <section className={`space-y-4 ${panel === "editor" ? "block" : "hidden lg:block"}`}>
          {selected ? (
            <div className="card">
              <SectionEditor
                key={selected.id}
                sectionId={selected.id}
                title={selected.sectionTitle}
                initialContent={selected.content ?? ""}
                initialVersion={selected.updatedAt}
                readOnly={!canEdit}
                onReload={() => router.refresh()}
              />
              {selected.sourceReferences && selected.sourceReferences.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                  <SourceReferenceList sources={selected.sourceReferences} />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    These are section-level references. Paragraph-level provenance is not available yet.
                  </p>
                </div>
              )}
              {canApproveSection && selected.status !== "APPROVED" && (
                <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                  <Button size="sm" variant="secondary" onClick={() => approveSection(selected.id)} pending={busyAction === "section"}>
                    Approve this section
                  </Button>
                </div>
              )}
              {canEdit && (
                <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                  <CommentsThread entityType="report_section" entityId={selected.id} heading="Section comments" />
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {canGenerate
                  ? "Select a section to edit, or generate a draft to populate the report structure."
                  : "You do not have permission to edit report sections."}
              </p>
            </div>
          )}
        </section>

        {/* Right: context */}
        <aside className={`space-y-4 ${panel === "context" ? "block" : "hidden lg:block"}`}>
          <section className="card">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Readiness</h3>
            <div className="mt-2">
              <ReadinessGauge value={readiness.overall} />
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <ReadinessRow label="Sections" v={readiness.sectionsScore} href={`/projects/${projectId}/reports`} />
              <ReadinessRow label="Indicators" v={readiness.indicatorsScore} href={`/projects/${projectId}/logframe`} />
              <ReadinessRow label="Evidence" v={readiness.evidenceScore} href={`/projects/${projectId}/evidence`} />
              <ReadinessRow label="Checklist" v={readiness.checklistScore} href={`/projects/${projectId}/compliance?period=${periodId}`} />
              <ReadinessRow label="Approval" v={readiness.approvalScore} href={`/projects/${projectId}/reports/${periodId}`} />
            </dl>
          </section>

          <section className="card">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Open checklist items</h3>
            {openChecklist.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No open items.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {openChecklist.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{c.title}</span>
                    <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link className="btn-secondary mt-3 block text-center text-xs" href={`/projects/${projectId}/compliance?period=${periodId}`}>
              Manage compliance
            </Link>
          </section>
        </aside>
      </div>

      {draft && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReviewAndApproval
            draftId={draft.id}
            draftStatus={draft.status}
            sections={sections}
            checklist={checklist}
            unverifiedIndicatorCount={unverifiedIndicatorCount}
            sensitiveEvidenceCount={sensitiveEvidenceCount}
            capabilities={capabilities}
          />
          <ExportsPanel
            projectId={projectId}
            periodId={periodId}
            initialExports={exports}
            canExport={can(capabilities, "export.create")}
          />
        </div>
      )}
    </div>
  );
}

function ReadinessRow({ label, v, href }: { label: string; v: number; href: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={href} className="text-slate-500 hover:text-brand-600 hover:underline dark:text-slate-400 dark:hover:text-brand-400">
        {label}
      </Link>
      <span className="font-mono text-xs">{v}%</span>
    </div>
  );
}
