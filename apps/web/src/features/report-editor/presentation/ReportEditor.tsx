"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChartConfig } from "@donordesk/domain/contexts/reporting/chart-config.js";
import {
  activateReportDraftAction,
  approveReportAction,
  approveReportSectionAction,
  createReportSectionAction,
  deleteReportSectionAction,
  detectMissingAction,
  reorderReportSectionsAction,
  submitReportForReviewAction,
} from "@/lib/actions/reporting";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { can, type Capability } from "@/lib/shared/capabilities";
import type { ReportArtifact } from "@/lib/server/schemas";
import { useToast } from "@/components/feedback/Toast";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Drawer } from "@/components/feedback/Drawer";
import { DraftVersionsPanel, type DraftVersion } from "@/features/reporting/presentation/DraftVersionsPanel";
import { StoryPanel } from "@/features/reporting/presentation/StoryPanel";
import { FlexibleInputsPanel } from "@/features/reporting/presentation/FlexibleInputsPanel";
import type { ChartFigureIndicator } from "@/features/reporting/presentation/ChartFigure";
import { buildEditorModel } from "../application/editor-model";
import type { ReportCheck } from "../application/report-checks";
import { serializeEditorUrlState, type EditorUrlState, type InspectorPanel } from "../application/url-state";
import { useDraftGeneration } from "./useDraftGeneration";
import { EditorTopBar } from "./top-bar/EditorTopBar";
import type { MenuItem } from "./top-bar/MoreActionsMenu";
import { OutlineNav } from "./outline/OutlineNav";
import { DocumentSection } from "./document/DocumentSection";
import { GenerateLaunchCard } from "./document/GenerateLaunchCard";
import { Inspector } from "./inspector/Inspector";
import type { InspectorClaim } from "./inspector/StatementsTab";
import type { SourceRef } from "./inspector/SourcesTab";

type EditorSection = {
  id: string;
  sectionTitle: string;
  sectionOrder?: number;
  content?: string;
  sourceReferences?: SourceRef[];
  status: string;
  chartConfig?: ChartConfig | null;
  updatedAt: string;
  generatedWithAi?: boolean | null;
};

type IndicatorRow = {
  code: string;
  name: string;
  baseline: string;
  target: string;
  unit?: string;
  update: { periodAchievement: string; verificationStatus: string } | null;
};

type SmartReviewItem = {
  id: string;
  severity: "BLOCKING" | "WARNING";
  title: string;
  explanation: string;
  claimId?: string;
  sectionId?: string;
  evidenceId?: string;
  action: { type: string; label: string };
};

export type ReportEditorProps = {
  projectId: string;
  periodId: string;
  heading: { eyebrow: string; title: string };
  draft: { id: string; title: string; status: string; version: number } | null;
  sections: EditorSection[];
  artifacts: Record<string, ReportArtifact[]>;
  claims: InspectorClaim[];
  versions: DraftVersion[];
  indicators: IndicatorRow[];
  readinessPercent: number;
  checklist: Array<{ id: string; title: string; severity: string; status: string }>;
  unverifiedIndicatorCount: number;
  sensitiveEvidenceCount: number;
  smartReviewItems: SmartReviewItem[];
  storyAnsweredCount: number;
  capabilities: readonly Capability[];
  initialUrlState: EditorUrlState;
};

type Confirm = { kind: "delete"; id: string; title: string } | { kind: "regenerate" } | { kind: "approve-report" } | null;

/**
 * Report Editor v2 — the document-first reporting workspace. One continuous
 * document, an outline, a per-section inspector and a single workflow-driven
 * primary action (see memorybank/imp/REPORT-EDITOR-V2-IMPLEMENTATION-PLAN.md).
 */
export function ReportEditor(props: ReportEditorProps) {
  const { projectId, periodId, draft } = props;
  const router = useRouter();
  const toast = useToast();
  const generation = useDraftGeneration(periodId, props.sections);
  const sections = generation.liveSections;

  const [ui, setUi] = useState<EditorUrlState>(props.initialUrlState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [inputsOpen, setInputsOpen] = useState(false);
  const [storyAnswered, setStoryAnswered] = useState(props.storyAnsweredCount);

  // Follow deep links on soft navigation (Smart Review, notifications).
  const { section: urlSection, panel: urlPanel, claim: urlClaim } = props.initialUrlState;
  useEffect(() => {
    setUi({ section: urlSection, panel: urlPanel, claim: urlClaim });
  }, [urlSection, urlPanel, urlClaim]);
  useEffect(() => setStoryAnswered(props.storyAnsweredCount), [props.storyAnsweredCount]);

  // A deep link opens the page on a section: bring it into view once.
  useEffect(() => {
    if (!urlSection) return;
    const timer = window.setTimeout(
      () => document.getElementById(`section-${urlSection}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [urlSection]);

  const caps = {
    canGenerate: can(props.capabilities, "report.generate"),
    canEdit: can(props.capabilities, "reporting.edit"),
    canApproveSection: can(props.capabilities, "report.approve"),
    canApproveReport: can(props.capabilities, "report.approve"),
    canExport: can(props.capabilities, "export.create"),
  };
  const canResolveClaim = can(props.capabilities, "report.resolve-claim");
  const canOverrideConfidential = can(props.capabilities, "report.override-confidentiality");

  const model = useMemo(
    () =>
      buildEditorModel({
        projectId,
        periodId,
        sections,
        claims: props.claims,
        checklist: props.checklist,
        unverifiedIndicatorCount: props.unverifiedIndicatorCount,
        sensitiveEvidenceCount: props.sensitiveEvidenceCount,
        smartReviewItems: props.smartReviewItems,
        draftStatus: draft?.status ?? null,
        generating: generation.generating,
        readinessPercent: props.readinessPercent,
        capabilities: caps,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, periodId, sections, props.claims, props.checklist, props.unverifiedIndicatorCount, props.sensitiveEvidenceCount, props.smartReviewItems, draft?.status, generation.generating, props.readinessPercent, props.capabilities],
  );

  const selectedId = ui.section && sections.some((s) => s.id === ui.section) ? ui.section : (sections.find((s) => s.status !== "NOT_STARTED")?.id ?? null);
  const panel: InspectorPanel = ui.panel ?? "statements";
  const selectedVM = model.sections.find((s) => s.id === selectedId) ?? null;
  const selectedSection = sections.find((s) => s.id === selectedId) ?? null;
  const canAuthor = model.mode === "author" && model.phase === "DRAFT";
  const base = `/projects/${projectId}/reports/${periodId}`;

  const chartIndicators = useMemo<ChartFigureIndicator[]>(
    () =>
      props.indicators.map((i) => ({
        code: i.code,
        name: i.name,
        baseline: i.baseline,
        target: i.target,
        unit: i.unit,
        achievement: i.update?.periodAchievement ?? "0",
        status: i.update?.verificationStatus ?? "DRAFT",
      })),
    [props.indicators],
  );

  // URL is updated with history.replaceState: selection changes must not
  // trigger a server re-render of the whole page.
  const updateUi = useCallback((next: EditorUrlState) => {
    setUi(next);
    const qs = serializeEditorUrlState(next, new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  const goToSection = useCallback(
    (sectionId: string, next?: { panel?: InspectorPanel; claim?: string }) => {
      updateUi({ section: sectionId, panel: next?.panel ?? (ui.panel === "checks" ? "statements" : ui.panel), claim: next?.claim });
      window.requestAnimationFrame(() =>
        document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    [ui.panel, updateUi],
  );

  async function run<T>(key: string, action: () => Promise<Result<T, AppError>>, success?: string): Promise<T | undefined> {
    setBusy(key);
    try {
      const result = await action();
      if (!result.ok) {
        toast.push({ title: result.error.message, tone: "danger" });
        return undefined;
      }
      if (success) toast.push({ title: success, tone: "success" });
      router.refresh();
      return result.value;
    } finally {
      setBusy(null);
    }
  }

  function onCheck(check: ReportCheck) {
    if (check.target.kind === "claim") goToSection(check.target.sectionId, { panel: "statements", claim: check.target.claimId });
    else if (check.target.kind === "section") goToSection(check.target.sectionId, { panel: "statements" });
  }

  async function approveSection(sectionId: string) {
    const vm = model.sections.find((s) => s.id === sectionId);
    const done = await run("approve-section", () => approveReportSectionAction(sectionId), vm ? `Section ${vm.number} approved` : undefined);
    if (done === undefined) return;
    // Approve & next: move to the next section still waiting for approval.
    const index = model.sections.findIndex((s) => s.id === sectionId);
    const next = [...model.sections.slice(index + 1), ...model.sections.slice(0, index)].find((s) => !s.isApproved && !s.isWriting);
    if (next) goToSection(next.id);
  }

  function onPrimary() {
    const p = model.primary;
    switch (p.kind) {
      case "generate":
        void generation.generate();
        break;
      case "review-statements":
        goToSection(p.sectionId, { panel: "statements", claim: p.claimId });
        break;
      case "approve-sections":
        goToSection(p.sectionId, { panel: "statements" });
        break;
      case "finish-checks":
        updateUi({ ...ui, panel: "checks" });
        break;
      case "submit":
        if (draft) void run("primary", () => submitReportForReviewAction(draft.id), "Report submitted for review");
        break;
      case "approve-report":
        setConfirm({ kind: "approve-report" });
        break;
      case "export":
        router.push(`${base}/export`);
        break;
      default:
        break;
    }
  }

  async function addSection(title: string): Promise<boolean> {
    if (!draft) return false;
    const created = await run("section-add", () => createReportSectionAction(draft.id, title), "Section added");
    if (created) updateUi({ section: created.id, panel: ui.panel });
    return created !== undefined;
  }

  function moveSection(id: string, offset: -1 | 1) {
    if (!draft) return;
    const ids = sections.map((s) => s.id);
    const from = ids.indexOf(id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    void run("reorder", () => reorderReportSectionsAction(draft.id, ids));
  }

  const menuItems: MenuItem[] = [];
  if (caps.canGenerate && draft && !generation.generating) {
    menuItems.push({ label: "Regenerate whole draft", hint: "Creates a new version; this one stays in history", onSelect: () => setConfirm({ kind: "regenerate" }) });
  }
  menuItems.push({ label: "Edit data & story", hint: "Story answers and quick imports", onSelect: () => setInputsOpen(true) });
  menuItems.push({ label: "Enter indicator data", hint: "Period values and verification", href: `${base}/indicators` });
  if (caps.canGenerate) {
    menuItems.push({
      label: "Scan for missing items",
      hint: "Check the report against the donor checklist",
      onSelect: () => void run("scan", () => detectMissingAction(periodId), "Scan finished — checks updated"),
    });
  }
  if (props.versions.length > 0) {
    menuItems.push({ label: "Version history", hint: `${props.versions.length} version${props.versions.length === 1 ? "" : "s"}`, onSelect: () => setVersionsOpen(true) });
  }
  menuItems.push({ label: "Export center", hint: "Past exports and downloads", href: `${base}/export` });
  menuItems.push({ label: "Switch to classic view", hint: "The previous workspace layout", href: `${base}?editor=classic` });

  const approveBlocking = model.checks.filter((c) => c.severity === "BLOCKING").length;
  const hasDocument = Boolean(draft) && sections.length > 0;

  return (
    <div className="animate-fade-in">
      <EditorTopBar
        backHref={`/projects/${projectId}/reports`}
        eyebrow={props.heading.eyebrow}
        title={draft?.title ?? props.heading.title}
        draftStatus={draft?.status ?? null}
        version={draft?.version ?? null}
        readinessPercent={model.readiness.percent}
        todo={model.readiness.todo}
        checksOpen={panel === "checks"}
        onOpenChecks={() => updateUi({ ...ui, panel: panel === "checks" ? "statements" : "checks" })}
        primary={hasDocument || model.primary.kind !== "generate" ? model.primary : { kind: "none" }}
        primaryPending={busy === "primary" || generation.starting}
        onPrimary={onPrimary}
        menuItems={menuItems}
        generation={{
          active: generation.generating,
          done: generation.progress.done,
          total: generation.progress.total,
          etaLabel: generation.progress.etaLabel,
          stopping: generation.stopping,
          onStop: () => void generation.stop(),
        }}
      />

      {(generation.message || generation.error) && (
        <div
          role={generation.error ? "alert" : "status"}
          className={`mt-4 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
            generation.error
              ? "border-danger-500/30 bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400"
              : "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          }`}
        >
          <span>{generation.error ?? generation.message}</span>
          {generation.message && (
            <button type="button" onClick={generation.clearMessage} className="text-xs text-slate-500 hover:underline">
              Dismiss
            </button>
          )}
        </div>
      )}

      {!hasDocument ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-8 dark:border-white/10 dark:bg-slate-900/40">
          <GenerateLaunchCard
            indicatorCount={props.indicators.length}
            unverifiedIndicatorCount={props.unverifiedIndicatorCount}
            storyAnswered={storyAnswered}
            indicatorsHref={`${base}/indicators`}
            canGenerate={caps.canGenerate}
            starting={generation.starting}
            onGenerate={() => void generation.generate()}
            onOpenStory={() => setInputsOpen(true)}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[200px_minmax(0,1fr)_320px]">
          <aside className="hidden xl:block">
            <div className="sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto pb-4 pr-1">
              <OutlineNav
                sections={model.sections}
                approvedCount={model.approvedCount}
                selectedId={selectedId}
                onSelect={(id) => goToSection(id)}
                canManage={canAuthor && !generation.generating}
                busy={busy !== null}
                onAdd={addSection}
                onMove={moveSection}
                onDelete={(id, title) => setConfirm({ kind: "delete", id, title })}
              />
            </div>
          </aside>

          <div className="min-w-0">
            <label className="mb-3 flex items-center gap-2 text-sm xl:hidden">
              <span className="shrink-0 text-slate-600 dark:text-slate-300">Section</span>
              <select
                value={selectedId ?? ""}
                onChange={(e) => goToSection(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-white/15 dark:bg-slate-900"
              >
                {model.sections.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.isWriting}>
                    {s.number}. {s.title}
                    {s.isApproved ? " ✓" : s.openStatements > 0 ? ` (${s.openStatements} to decide)` : ""}
                  </option>
                ))}
              </select>
            </label>
            <article className="rounded-xl border border-slate-200 bg-white px-6 py-8 shadow-sm dark:border-white/10 dark:bg-slate-900/40 sm:px-10">
              <header className="mb-4 border-b border-slate-200 pb-5 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">{props.heading.eyebrow}</p>
                <p className="mt-1 text-2xl font-semibold leading-tight tracking-tight">{draft?.title}</p>
              </header>
              {sections.map((s) => {
                const vm = model.sections.find((v) => v.id === s.id);
                if (!vm) return null;
                return (
                  <DocumentSection
                    key={s.id}
                    vm={vm}
                    section={s}
                    artifacts={props.artifacts[s.id] ?? []}
                    chartIndicators={chartIndicators}
                    selected={s.id === selectedId}
                    editing={s.id === editingId}
                    canEdit={canAuthor && !generation.generating}
                    approving={busy === "approve-section"}
                    onSelect={() => updateUi({ section: s.id, panel: panel === "checks" ? "statements" : panel })}
                    onEdit={() => setEditingId(s.id)}
                    onDoneEditing={() => {
                      setEditingId(null);
                      router.refresh();
                    }}
                    onApprove={() => void approveSection(s.id)}
                    onReload={() => router.refresh()}
                  />
                );
              })}
            </article>
          </div>

          <aside className="min-w-0">
            <div className="xl:sticky xl:top-36 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto xl:pb-4">
              <Inspector
                projectId={projectId}
                panel={panel}
                onPanel={(p) => updateUi({ ...ui, panel: p, claim: undefined })}
                section={selectedVM}
                sectionData={selectedSection}
                claims={props.claims.filter((c) => c.sectionId === selectedId)}
                focusClaimId={ui.claim}
                checks={model.checks}
                onCheck={onCheck}
                chartIndicators={chartIndicators}
                canEdit={canAuthor}
                canResolveClaim={canResolveClaim}
                canOverrideConfidential={canOverrideConfidential}
                onReload={() => router.refresh()}
              />
            </div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete section?"
        message={confirm?.kind === "delete" ? `“${confirm.title}” and its checked statements will be removed from this draft.` : ""}
        confirmLabel="Delete section"
        onConfirm={async () => {
          if (confirm?.kind !== "delete") return;
          const id = confirm.id;
          await run("section-delete", () => deleteReportSectionAction(id), "Section deleted");
          setConfirm(null);
          if (selectedId === id) updateUi({ panel: ui.panel });
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "regenerate"}
        onClose={() => setConfirm(null)}
        title="Regenerate the whole draft?"
        message={`This writes a new version ${draft ? draft.version + 1 : ""} from your current data. The current version and its edits stay in Version history.`}
        confirmLabel="Regenerate"
        tone="primary"
        onConfirm={async () => {
          setConfirm(null);
          await generation.generate();
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "approve-report"}
        onClose={() => setConfirm(null)}
        title="Approve this report?"
        message={
          approveBlocking > 0
            ? `${approveBlocking} check${approveBlocking === 1 ? " is" : "s are"} still open. Approving locks this version for export and is recorded in the audit trail.`
            : "Approving locks this version for export and is recorded in the audit trail."
        }
        confirmLabel="Approve report"
        tone="primary"
        onConfirm={async () => {
          if (!draft) return;
          await run("primary", () => approveReportAction(draft.id), "Report approved");
          setConfirm(null);
        }}
      />

      <Drawer open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Version history">
        <DraftVersionsPanel
          versions={props.versions}
          currentDraftId={draft?.id ?? null}
          canEdit={caps.canEdit}
          busy={busy === "activate"}
          onActivate={(draftId) => {
            void run("activate", () => activateReportDraftAction(draftId), "Version restored").then(() => setVersionsOpen(false));
          }}
        />
      </Drawer>

      <Drawer open={inputsOpen} onClose={() => setInputsOpen(false)} title="Data & story">
        <div className="-mx-1 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto px-1 pb-8">
          <Link href={`${base}/indicators`} className="block text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            Enter indicator data →
          </Link>
          <StoryPanel periodId={periodId} onSaved={setStoryAnswered} />
          <FlexibleInputsPanel projectId={projectId} periodId={periodId} />
        </div>
      </Drawer>
    </div>
  );
}
