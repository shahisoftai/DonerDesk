"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateDraftAction, getReportDraftAction, detectMissingAction, submitReportForReviewAction, approveReportSectionAction, createReportSectionAction, deleteReportSectionAction, reorderReportSectionsAction, cancelReportGenerationAction, activateReportDraftAction } from "@/lib/actions/reporting";
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
import { ReportingStepGuide } from "./ReportingStepGuide";
import { StoryPanel } from "./StoryPanel";
import { FlexibleInputsPanel } from "./FlexibleInputsPanel";
import { SmartReviewPanel } from "./SmartReviewPanel";
import { ReportCheckPanel } from "./ReportCheckPanel";
import { ReportChartPanel } from "./ReportChartPanel";
import { ClaimResolutionActions } from "./ClaimResolutionActions";
import { ReportReviewPanel } from "./ReportReviewPanel";
import { ReportPreviewPanel } from "./ReportPreviewPanel";
import { DraftVersionsPanel } from "./DraftVersionsPanel";
import type { ChartConfig } from "@donordesk/domain/contexts/reporting/chart-config.js";
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
  chartConfig?: ChartConfig | null;
  updatedAt: string;
  generatedWithAi?: boolean | null;
};
type ReportClaim = {
  id: string;
  sectionId: string;
  text: string;
  type: string;
  sources?: Array<{ evidenceId: string; chunkId: string; sourceText: string }>;
  verificationResult: string;
  verificationDetail: string;
  resolutionNotes?: string | null;
  resolvedById?: string;
  resolvedAt?: string;
};
type ReportDraft = {
  id: string;
  title: string;
  status: string;
  version: number;
  generatedByAi?: boolean;
};
type DraftVersion = {
  id: string;
  title: string;
  status: string;
  version: number;
  generatedByAi?: boolean;
  approvedById?: string;
  approvedAt?: string | null;
  supersededAt?: string | null;
  createdAt: string;
};

type ChartIndicator = {
  code: string;
  name: string;
  baseline: string;
  target: string;
  unit?: string;
  achievement: string;
  status: string;
};

type RawIndicatorRow = {
  id: string;
  code: string;
  name: string;
  baseline: string;
  target: string;
  unit?: string;
  update: {
    periodAchievement: string;
    verificationStatus: string;
  } | null;
};

type Panel = "sections" | "editor" | "context";

export function ReportWorkspace({
  projectId,
  periodId,
  draft,
  sections,
  claims,
  versions,
  indicators,
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
  claims: ReportClaim[];
  versions: DraftVersion[];
  indicators: RawIndicatorRow[];
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
  const [mode, setMode] = useState<"editor" | "review" | "check" | "preview" | "versions">("editor");
  const [draftMsg, setDraftMsg] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [liveSections, setLiveSections] = useState<ReportSection[]>(sections);
  const [generating, setGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Keep the local section list in sync with server-rendered props unless a
  // background section-wise generation is polling and owns the list.
  useEffect(() => {
    if (!generating) setLiveSections(sections);
  }, [sections, generating]);

  const canGenerate = can(capabilities, "report.generate");
  const canEdit = can(capabilities, "reporting.edit");
  const canApproveSection = can(capabilities, "report.approve");
  const canResolveClaim = can(capabilities, "report.resolve-claim");
  const canOverrideConfidential = can(capabilities, "report.override-confidentiality");

  async function approveSection(sectionId: string) {
    setBusyAction("section");
    try {
      const result = await approveReportSectionAction(sectionId);
      if (!result.ok) {
        setSectionError(result.error.message);
      } else {
        setSectionError(null);
      }
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    if (liveSections.length === 0) {
      setSelectedId(null);
    } else if (!liveSections.some((s) => s.id === selectedId)) {
      setSelectedId(liveSections[0]!.id);
    }
  }, [liveSections, selectedId]);

  const selected = liveSections.find((s) => s.id === selectedId) ?? null;
  const pendingSectionCount = liveSections.filter((s) => s.status === "NOT_STARTED").length;
  const approvedSectionCount = liveSections.filter((s) => s.status === "APPROVED").length;
  const pendingFailedClaims = claims.filter((c) => c.verificationResult === "FAILED" && !c.resolvedById).length;
  const openChecklist = checklist.filter((c) => c.status !== "RESOLVED" && c.status !== "ACCEPTED_RISK" && c.status !== "NOT_APPLICABLE");
  const aiEnabledLabel = draft ? (draft.generatedByAi ? "AI-assisted draft" : "Manually created draft") : null;

  // Simple remaining-time estimate while sections draft in the background:
  // average time per completed section projected over the pending sections.
  const generationEtaLabel = useMemo(() => {
    if (!generating || !generationStartedAt || generatedCount <= 0) return null;
    const elapsedMs = Date.now() - generationStartedAt;
    const perSectionMs = elapsedMs / generatedCount;
    const remaining = Math.max(0, liveSections.length - generatedCount);
    if (remaining === 0) return null;
    const etaSec = Math.round((perSectionMs * remaining) / 1000);
    if (etaSec <= 0) return null;
    const mins = Math.floor(etaSec / 60);
    const secs = etaSec % 60;
    return `~${mins > 0 ? `${mins}m ` : ""}${secs}s left`;
  }, [generating, generationStartedAt, generatedCount, liveSections.length]);

  // The one thing the user should do next, in plain language. Each step links
  // to the exact place where it is fixed; nothing here exposes internal
  // assurance or revision terminology.
  type NextStep = { label: string; href?: string; action?: () => void };
  const nextSteps: NextStep[] = [];
  if (unverifiedIndicatorCount > 0) {
    nextSteps.push({
      label: `Enter and verify ${unverifiedIndicatorCount} indicator row${unverifiedIndicatorCount === 1 ? "" : "s"}`,
      href: `/projects/${projectId}/reports/${periodId}/indicators`,
    });
  }
  if (!draft) {
    nextSteps.push({ label: "Generate the AI draft", action: () => void generate() });
  } else {
    if (pendingFailedClaims > 0) {
      nextSteps.push({
        label: `Review ${pendingFailedClaims} statement${pendingFailedClaims === 1 ? "" : "s"} that need a decision`,
        action: () => setMode("review"),
      });
    }
    if (liveSections.length > 0 && approvedSectionCount < liveSections.length) {
      nextSteps.push({
        label: `Approve the remaining ${liveSections.length - approvedSectionCount} section${liveSections.length - approvedSectionCount === 1 ? "" : "s"}`,
        action: () => setMode("editor"),
      });
    }
    if (liveSections.length > 0 && approvedSectionCount === liveSections.length && draft.status === "DRAFT") {
      nextSteps.push({ label: "Submit the report for review", action: () => void submitReview() });
    }
    if (draft.status === "UNDER_REVIEW") {
      nextSteps.push({ label: "Approve the report", action: () => setMode("editor") });
    }
  }

  // Flat chart-ready indicator rows; a single memoised map is shared by every
  // section's chart panel.
  const chartIndicators = useMemo<ChartIndicator[]>(
    () =>
      indicators.map((i) => ({
        code: i.code,
        name: i.name,
        baseline: i.baseline,
        target: i.target,
        unit: i.unit,
        achievement: i.update?.periodAchievement ?? "0",
        status: i.update?.verificationStatus ?? "DRAFT",
      })),
    [indicators],
  );

  async function generate() {
    setBusyAction("draft");
    setDraftMsg(null);
    try {
      const result = await actionState.run(() => generateDraftAction(periodId));
      if (result) {
        if (result.generating) {
          // Section-wise generation: skeleton returned immediately; poll the
          // draft until every section has been drafted in the background.
          setGenerating(true);
          setGenerationStartedAt(Date.now());
          setDraftMsg(null);
        } else {
          const fallbackSuffix = result.fallbackUsed
            ? ` Content shown is a structured placeholder because the AI provider was unavailable${result.fallbackReason ? ` (${result.fallbackReason})` : ""}.`
            : "";
          setDraftMsg(`Draft generated with ${result.sectionIds.length} sections.${fallbackSuffix}`);
          router.refresh();
        }
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function stopGeneration() {
    setBusyAction("stop");
    try {
      const result = await cancelReportGenerationAction(periodId);
      if (result.ok) {
        setGenerating(false);
        setGenerationStartedAt(null);
        setDraftMsg(result.value.cancelled ? "Generation stopped. Generate a new draft to continue." : "No active generation to stop.");
      }
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function activateVersion(draftId: string) {
    setBusyAction("activate");
    try {
      const result = await activateReportDraftAction(draftId);
      if (!result.ok) {
        setSectionError(result.error.message);
        return;
      }
      setMode("editor");
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  // Poll the draft while a background section-wise generation is in flight.
  // Each section flips NOT_STARTED -> DRAFTED as it completes, and the left
  // column updates in place instead of blocking on a single long LLM call.
  useEffect(() => {
    if (!generating) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_POLL_ATTEMPTS = 120; // ~8 minutes: a 9-section draft at ~40s/section
    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        setGenerating(false);
        setDraftMsg("Generation is still running in the background. You can keep editing completed sections or refresh to see the latest progress.");
        return;
      }
      const result = await actionState.run(() => getReportDraftAction(periodId));
      if (cancelled) return;
      if (result) {
        const next = (result.sections ?? []).sort((a, b) => a.sectionOrder - b.sectionOrder);
        setLiveSections(next);
        const done = next.filter((s) => s.status !== "NOT_STARTED").length;
        setGeneratedCount(done);
        if (next.length > 0 && done >= next.length) {
          setGenerating(false);
          setDraftMsg("All sections drafted.");
          router.refresh();
          return;
        }
      }
      window.setTimeout(poll, 4000);
    };
    const timer = window.setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

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

  async function addSection() {
    if (!draft || !newSectionTitle.trim()) return;
    setBusyAction("section-add");
    try {
      const result = await actionState.run(() => createReportSectionAction(draft.id, newSectionTitle.trim()));
      if (result !== undefined) {
        setNewSectionTitle("");
        setAddingSection(false);
        router.refresh();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function removeSection(sectionId: string, sectionTitle: string) {
    if (!window.confirm(`Delete "${sectionTitle}"? Its content, sources, and verification history will be permanently removed.`)) return;
    setBusyAction("section-delete");
    try {
      const result = await actionState.run(() => deleteReportSectionAction(sectionId));
      if (result !== undefined) {
        setSelectedId(null);
        router.refresh();
      }
    } finally {
      setBusyAction(null);
    }
  }

  const canReorder = Boolean(canEdit && draft && draft.status === "DRAFT" && liveSections.length > 1);

  async function persistOrder(nextSections: ReportSection[]) {
    if (!draft) return;
    const currentIds = liveSections.map((s) => s.id).join(",");
    const nextIds = nextSections.map((s) => s.id);
    if (nextIds.join(",") === currentIds) return;
    setBusyAction("section-reorder");
    try {
      const result = await actionState.run(() => reorderReportSectionsAction(draft.id, nextIds));
      if (result !== undefined) router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  function moveSectionTo(targetId: string) {
    if (draggingId === null) return;
    const from = liveSections.findIndex((s) => s.id === draggingId);
    const to = liveSections.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...liveSections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setDraggingId(null);
    setDragOverId(null);
    void persistOrder(next);
  }

  function moveSectionByOffset(sectionId: string, offset: number) {
    const from = liveSections.findIndex((s) => s.id === sectionId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= liveSections.length) return;
    const next = [...liveSections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    void persistOrder(next);
  }

  return (
    <div className="mt-6 space-y-4">
      <ReportingStepGuide projectId={projectId} periodId={periodId} hasDraft={Boolean(draft)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{draft ? draft.title : "No report draft yet"}</h2>
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
            <Button size="sm" variant="secondary" disabled={busyAction === "draft" || generating} onClick={generate} pending={generating || busyAction === "draft"}>
              {generating ? `Generating… ${generatedCount}/${liveSections.length}${generationEtaLabel ? ` (${generationEtaLabel})` : ""}` : busyAction === "draft" ? "Generating…" : draft ? "Regenerate AI draft" : "Generate AI draft"}
            </Button>
          )}
          {generating && (
            <Button size="sm" variant="ghost" disabled={busyAction === "stop"} onClick={stopGeneration} pending={busyAction === "stop"}>
              Stop generation
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
            className={`rounded-md px-3 py-1.5 ${panel === key ? "bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr_260px]">
        {/* Left: section navigation */}
        <aside className={`space-y-2 ${panel === "sections" ? "block" : "hidden lg:block"}`}>
          {liveSections.length === 0 && (
            <div className="card text-sm text-slate-600 dark:text-slate-300">
              <p>No sections yet. Generate a draft to create the report structure, or add a section manually.</p>
            </div>
          )}
          {generating && (
            <div className="card space-y-1 p-3 text-sm">
              <p className="font-medium text-brand-700 dark:text-brand-300">
                Generating sections… {generatedCount}/{liveSections.length || draft?.title ? "" : ""}
              </p>
              {pendingSectionCount > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pendingSectionCount} section{pendingSectionCount === 1 ? "" : "s"} left. Each section is drafted in its own AI call, so the report fills in one section at a time.
                </p>
              )}
            </div>
          )}
          {draft && canEdit && draft.status === "DRAFT" && (
            <div className="space-y-2">
              {addingSection ? (
                <div className="card space-y-2 p-3">
                  <input
                    type="text"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void addSection();
                      if (e.key === "Escape") {
                        setAddingSection(false);
                        setNewSectionTitle("");
                      }
                    }}
                    placeholder="Section title"
                    autoFocus
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-white/5"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyAction !== null}
                      onClick={() => {
                        setAddingSection(false);
                        setNewSectionTitle("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" disabled={busyAction !== null || !newSectionTitle.trim()} pending={busyAction === "section-add"} onClick={() => void addSection()}>
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" className="w-full" disabled={busyAction !== null} onClick={() => setAddingSection(true)}>
                  + Add section
                </Button>
              )}
            </div>
          )}
          <nav aria-label="Report sections" className="space-y-1.5">
            {canReorder && !generating && (
              <p className="px-1 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Drag or use arrows to reorder</p>
            )}
            {liveSections.map((s, index) => (
              <div
                key={s.id}
                draggable={canReorder && !generating}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", s.id);
                  setDraggingId(s.id);
                }}
                onDragOver={(e) => {
                  if (draggingId === null || draggingId === s.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverId(s.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  moveSectionTo(s.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                className={`flex items-center gap-1 rounded-lg border transition ${
                  s.status === "NOT_STARTED"
                    ? "border-slate-200/70 bg-slate-50 opacity-60 dark:border-white/5 dark:bg-white/[0.02]"
                    : selectedId === s.id
                      ? "border-brand-500/40 bg-brand-500/5"
                      : "border-slate-200 hover:border-brand-400/40 dark:border-white/10"
                } ${draggingId === s.id ? "opacity-50" : ""} ${
                  dragOverId === s.id && draggingId !== null && draggingId !== s.id
                    ? "border-brand-500 ring-1 ring-brand-500/40"
                    : ""
                } ${canReorder && !generating ? "cursor-grab active:cursor-grabbing" : ""}`}
              >
                {canReorder && !generating && (
                  <span aria-hidden="true" className="pl-1.5 text-slate-400 dark:text-slate-500">
                    ⋮⋮
                  </span>
                )}
                <button
                  type="button"
                  disabled={s.status === "NOT_STARTED"}
                  onClick={() => {
                    setSelectedId(s.id);
                    setSectionError(null);
                    setPanel("editor");
                  }}
                  aria-current={selectedId === s.id ? "true" : undefined}
                  className="flex w-full items-center justify-between gap-2 rounded-l-lg px-2 py-2 text-left text-sm"
                >
                  <span className={`min-w-0 break-words leading-5 ${s.status === "NOT_STARTED" ? "italic text-slate-400 dark:text-slate-500" : ""}`}>
                    {s.status === "NOT_STARTED" && <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-slate-400" />}
                    {index + 1}. {s.sectionTitle}
                  </span>
                  <Badge tone={sectionStatusTone(s.status)}>{SECTION_STATUS_LABEL[s.status] ?? s.status.replace(/_/g, " ")}</Badge>
                </button>
                {canReorder && !generating && (
                  <span className="flex shrink-0 items-center gap-0.5 pr-1">
                    <button
                      type="button"
                      title={`Move ${s.sectionTitle} up`}
                      aria-label={`Move ${s.sectionTitle} up`}
                      disabled={busyAction !== null || index === 0}
                      onClick={() => moveSectionByOffset(s.id, -1)}
                      className="rounded-md px-1 py-0.5 text-slate-400 transition hover:bg-brand-500/10 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:text-brand-400"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title={`Move ${s.sectionTitle} down`}
                      aria-label={`Move ${s.sectionTitle} down`}
                      disabled={busyAction !== null || index === liveSections.length - 1}
                      onClick={() => moveSectionByOffset(s.id, 1)}
                      className="rounded-md px-1 py-0.5 text-slate-400 transition hover:bg-brand-500/10 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:text-brand-400"
                    >
                      ↓
                    </button>
                  </span>
                )}
                {draft && canEdit && draft.status === "DRAFT" && (
                  <button
                    type="button"
                    title={`Delete ${s.sectionTitle}`}
                    aria-label={`Delete ${s.sectionTitle}`}
                    disabled={busyAction !== null}
                    onClick={() => void removeSection(s.id, s.sectionTitle)}
                    className="mr-1.5 rounded-md px-1.5 py-0.5 text-slate-400 transition hover:bg-danger-500/10 hover:text-danger-600 dark:hover:text-danger-400"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Center: editor / review / preview */}
        <section className={`space-y-4 ${panel === "editor" ? "block" : "hidden lg:block"}`}>
          {draft && (
            <div className="flex gap-1 border-b border-slate-200 pb-2 text-sm dark:border-white/10" role="tablist" aria-label="Report views">
              {(
                [
                  ["editor", "Edit sections"],
                  ["review", `Review${pendingFailedClaims > 0 ? ` (${pendingFailedClaims})` : ""}`],
                  ["check", "Report Check"],
                  ["preview", "Preview report"],
                  ["versions", `Versions${versions.length > 1 ? ` (${versions.length})` : ""}`],
                ] as Array<["editor" | "review" | "check" | "preview" | "versions", string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={`rounded-md px-3 py-1.5 ${mode === key ? "bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {mode === "review" ? (
            <SmartReviewPanel
              projectId={projectId}
              periodId={periodId}
              detail={
                <ReportReviewPanel
                  claims={claims}
                  sections={liveSections}
                  canResolveClaim={canResolveClaim}
                  canOverrideConfidential={canOverrideConfidential}
                  onResolved={() => router.refresh()}
                />
              }
            />
          ) : mode === "preview" ? (
            <ReportPreviewPanel sections={liveSections} />
          ) : mode === "versions" ? (
            <DraftVersionsPanel
              versions={versions}
              currentDraftId={draft?.id ?? null}
              canEdit={canEdit}
              onActivate={(draftId) => void activateVersion(draftId)}
              busy={busyAction === "activate"}
            />
          ) : mode === "check" ? (
            <ReportCheckPanel
              readiness={readiness}
              projectId={projectId}
              periodId={periodId}
              approval={
                draft ? (
                  <ReviewAndApproval
                    draftId={draft.id}
                    draftStatus={draft.status}
                    sections={liveSections}
                    checklist={checklist}
                    unverifiedIndicatorCount={unverifiedIndicatorCount}
                    sensitiveEvidenceCount={sensitiveEvidenceCount}
                    capabilities={capabilities}
                  />
                ) : undefined
              }
            />
          ) : selected ? (
            <div className="card">
              {selected.generatedWithAi === false && selected.content && (
                <p className="mb-3 rounded-md border border-warning-500/30 bg-warning-500/5 px-3 py-2 text-xs text-warning-700 dark:text-warning-400">
                  This section was drafted without AI (deterministic fallback) or was written manually. Review it carefully.
                </p>
              )}
              <SectionEditor
                key={selected.id}
                sectionId={selected.id}
                title={selected.sectionTitle}
                initialContent={selected.content ?? ""}
                initialVersion={selected.updatedAt}
                readOnly={!canEdit}
                onReload={() => router.refresh()}
              />
              {selected.sectionTitle.toLowerCase().includes("indicator") && (
                <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                  <ReportChartPanel
                    key={`chart-${selected.id}`}
                    sectionId={selected.id}
                    initialConfig={selected.chartConfig ?? null}
                    expectedVersion={selected.updatedAt}
                    indicators={chartIndicators}
                    readOnly={!canEdit}
                    onReload={() => router.refresh()}
                  />
                </div>
              )}
              {selected.sourceReferences && selected.sourceReferences.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                  <SourceReferenceList sources={selected.sourceReferences} />
                </div>
              )}
              {claims.filter((c) => c.sectionId === selected.id).length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                  <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Statement-level sources</p>
                  <ul className="space-y-2">
                    {claims
                      .filter((c) => c.sectionId === selected.id)
                      .map((c) => (
                        <li key={c.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm dark:border-white/10 dark:bg-white/5">
                          <p className="text-slate-700 dark:text-slate-200">{c.text}</p>
                          {c.sources && c.sources.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {c.sources.map((s) => (
                                <span
                                  key={`${c.id}-${s.evidenceId}-${s.chunkId}`}
                                  title={s.sourceText?.slice(0, 200)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 dark:border-white/15 dark:bg-white/10 dark:text-slate-400"
                                >
                                  <span className="uppercase opacity-70">evidence</span>
                                  {s.evidenceId.slice(0, 8)}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                            Verification: {c.verificationResult} — {c.verificationDetail}
                          </p>
                          {c.resolvedById ? (
                            <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                              Resolved{c.resolutionNotes ? ` — ${c.resolutionNotes}` : ""}
                            </p>
                          ) : c.verificationResult === "FAILED" ? (
                            <ClaimResolutionActions
                              claimId={c.id}
                              canResolve={canResolveClaim}
                              canOverrideConfidential={canOverrideConfidential}
                              onResolved={() => router.refresh()}
                            />
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {canApproveSection && selected.status !== "APPROVED" && (
                <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                  <Button size="sm" variant="secondary" onClick={() => approveSection(selected.id)} pending={busyAction === "section"}>
                    Approve this section
                  </Button>
                  {sectionError && (
                    <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">{sectionError}</p>
                  )}
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
          <StoryPanel periodId={periodId} />
          <FlexibleInputsPanel projectId={projectId} periodId={periodId} />
          {nextSteps.length > 0 && (
            <section className="card">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">What to do next</h3>
              <ol className="mt-2 space-y-1.5 text-sm">
                {nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-medium text-brand-700 dark:text-brand-300">
                      {index + 1}
                    </span>
                    {step.href ? (
                      <Link href={step.href} className="text-brand-700 hover:underline dark:text-brand-300">{step.label}</Link>
                    ) : (
                      <button type="button" onClick={step.action} className="text-left text-brand-700 hover:underline dark:text-brand-300">
                        {step.label}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="card">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Readiness</h3>
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
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Open checklist items</h3>
            {openChecklist.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No open items.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {openChecklist.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words leading-5">{c.title}</span>
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

      {draft && mode !== "check" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReviewAndApproval
            draftId={draft.id}
            draftStatus={draft.status}
            sections={liveSections}
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
            canResolveClaim={can(capabilities, "report.resolve-claim")}
            canOverrideConfidential={can(capabilities, "report.override-confidentiality")}
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
