"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChartConfig } from "@donordesk/domain/contexts/reporting/chart-config.js";
import {
  activateReportDraftAction,
  approveReportAction,
  approveReportSectionAction,
  createReportSectionAction,
  deleteReportSectionAction,
  detectMissingAction,
  reassessSectionAction,
  reorderReportSectionsAction,
  requestChangesAction,
  submitReportForReviewAction,
  updateReportSectionAction,
  type SectionRevision,
} from "@/lib/actions/reporting";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { can, type Capability } from "@/lib/shared/capabilities";
import type { ReportArtifact } from "@/lib/server/schemas";
import { useToast } from "@/components/feedback/Toast";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Drawer } from "@/components/feedback/Drawer";
import { AiActivityPopup } from "@/components/feedback/AiActivityPopup";
import { Button } from "@/components/ui/Button";
import { DraftVersionsPanel, type DraftVersion } from "@/features/reporting/presentation/DraftVersionsPanel";
import { HelpButton } from "@/features/tour/presentation/HelpButton";
import type { ChartFigureIndicator } from "@/features/reporting/presentation/ChartFigure";
import { buildEditorModel } from "../application/editor-model";
import { buildReportInputRows, type ReportScopeInfo } from "../application/report-inputs";
import type { ReportCheck } from "../application/report-checks";
import { serializeEditorUrlState, type EditorUrlState, type InspectorPanel } from "../application/url-state";
import { anchorClaims, type Anchor } from "../application/claim-anchors";
import { isOpenStatement } from "../application/statements";
import { buildIssueList, currentIssueKey, stepIssue } from "../application/issue-order";
import { matchVerifiedTables } from "../application/verified-tables";
import type { ShortcutAction } from "../application/shortcuts";
import type { RichEditorSaveStatus, RichEditorSaved } from "../rich-text/RichSectionEditor";
import { useDraftGeneration } from "./useDraftGeneration";
import { useSectionRegeneration, type RegenerationOutcome } from "./useSectionRegeneration";
import { useStatementDecisions } from "./useStatementDecisions";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { useMediaQuery } from "./useMediaQuery";
import { EditorTopBar } from "./top-bar/EditorTopBar";
import type { MenuItem } from "./top-bar/MoreActionsMenu";
import { OutlineNav } from "./outline/OutlineNav";
import { moveWithSubtree } from "../application/outline-tree";
import { ReportInputsCard } from "./outline/ReportInputsCard";
import { DocumentSection } from "./document/DocumentSection";
import { GenerateLaunchCard } from "./document/GenerateLaunchCard";
import { InputsChangedBanner } from "./document/InputsChangedBanner";
import { Inspector } from "./inspector/Inspector";
import type { InspectorClaim } from "./inspector/StatementsTab";
import type { SourceRef } from "./inspector/SourcesTab";
import { RequestChangesDialog } from "./dialogs/RequestChangesDialog";
import { ExportDialog } from "./dialogs/ExportDialog";
import { ShortcutSheet } from "./dialogs/ShortcutSheet";

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
  assuranceState?: string | null;
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
  /** Activity/situation reports: what the report covers (drives the input panels). */
  reportScope?: ReportScopeInfo;
  readinessPercent: number;
  checklist: Array<{ id: string; title: string; severity: string; status: string }>;
  unverifiedIndicatorCount: number;
  sensitiveEvidenceCount: number;
  smartReviewItems: SmartReviewItem[];
  storyAnsweredCount: number;
  evidenceCount: number;
  regeneratingSectionIds: string[];
  summaryStaleSectionIds: string[];
  commentCounts: Record<string, number>;
  inputsChangedSince: { indicators: number; evidence: number; sectionIds: string[] } | null;
  capabilities: readonly Capability[];
  initialUrlState: EditorUrlState;
};

type Confirm = { kind: "delete"; id: string; title: string } | { kind: "regenerate" } | { kind: "approve-report" } | null;

/** "Restore previous version" stays on the toast after a regenerate (U11). */
const RESTORE_UNDO_MS = 30_000;
const EVIDENCE_MARKS_KEY = "donordesk.report-editor.evidence-marks";

const GENERATION_STEPS = [
  "Gathering this period's indicator figures and evidence…",
  "Drafting each section from your data…",
  "Checking every figure against the evidence…",
  "Writing the executive summary and conclusion…",
  "Finishing up…",
] as const;
/** Paces the popup's bar before the first section reports progress (kickoff is normally a few seconds). */
const GENERATION_STARTING_ESTIMATED_MS = 12_000;
const NO_ANCHORS: ReadonlyMap<string, Anchor | null> = new Map();

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Report Editor v2 — the document-first reporting workspace. One continuous
 * document, an outline, a per-section inspector and a single workflow-driven
 * primary action (see memorybank/imp/REPORT-EDITOR-V2-IMPLEMENTATION-PLAN.md).
 */
export function ReportEditor(props: ReportEditorProps) {
  const { projectId, periodId, draft } = props;
  const router = useRouter();
  const toast = useToast();
  const refresh = useCallback(() => router.refresh(), [router]);
  const generation = useDraftGeneration(periodId, props.sections);

  const [ui, setUi] = useState<EditorUrlState>(props.initialUrlState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [recheckingKey, setRecheckingKey] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<RichEditorSaveStatus | null>(null);
  const [showEvidenceMarks, setShowEvidenceMarks] = useState(false);
  // Text saved from the editor that the page's server data may not include yet.
  const [overrides, setOverrides] = useState<Record<string, { content: string; version: string }>>({});

  const wideLayout = useMediaQuery("(min-width: 1280px)", true);
  const largeLayout = useMediaQuery("(min-width: 1024px)", true);

  useEffect(() => {
    try {
      setShowEvidenceMarks(window.localStorage.getItem(EVIDENCE_MARKS_KEY) === "1");
    } catch {
      // Storage unavailable: marks stay off.
    }
  }, []);

  // Follow deep links on soft navigation (Smart Review, notifications).
  const { section: urlSection, panel: urlPanel, claim: urlClaim } = props.initialUrlState;
  useEffect(() => {
    setUi({ section: urlSection, panel: urlPanel, claim: urlClaim });
  }, [urlSection, urlPanel, urlClaim]);

  // A deep link opens the page on a section: bring it into view once.
  useEffect(() => {
    if (!urlSection) return;
    const timer = window.setTimeout(
      () => document.getElementById(`section-${urlSection}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [urlSection]);

  // Drop saved-text overrides once the server data has caught up.
  useEffect(() => {
    setOverrides((current) => {
      let changed = false;
      const next = { ...current };
      for (const s of props.sections) {
        const o = next[s.id];
        if (o && s.updatedAt >= o.version) {
          delete next[s.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [props.sections]);

  const sections = useMemo(
    () =>
      generation.liveSections.map((s) => {
        const o = overrides[s.id];
        return o && o.version > s.updatedAt ? { ...s, content: o.content, updatedAt: o.version } : s;
      }),
    [generation.liveSections, overrides],
  );
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const caps = useMemo(
    () => ({
      canGenerate: can(props.capabilities, "report.generate"),
      canEdit: can(props.capabilities, "reporting.edit"),
      canApproveSection: can(props.capabilities, "report.approve"),
      canApproveReport: can(props.capabilities, "report.approve"),
      canExport: can(props.capabilities, "export.create"),
    }),
    [props.capabilities],
  );
  const canResolveClaim = can(props.capabilities, "report.resolve-claim");
  const canOverrideConfidential = can(props.capabilities, "report.override-confidentiality");

  const onRegenerationFinished = useCallback(
    (outcome: RegenerationOutcome) => {
      const title = sectionsRef.current.find((s) => s.id === outcome.sectionId)?.sectionTitle ?? "The section";
      if (!outcome.changed) {
        toast.push({ title: `“${title}” could not be rewritten — your text is unchanged. Try again later.`, tone: "warning" });
        return;
      }
      const { previousContent, version } = outcome;
      toast.push({
        title: `“${title}” was rewritten`,
        description: "It was checked against the evidence again.",
        tone: "success",
        durationMs: RESTORE_UNDO_MS,
        action:
          previousContent !== undefined && version
            ? { label: "Restore previous version", onAction: () => void restoreText(outcome.sectionId, previousContent, version) }
            : undefined,
      });
    },
    // restoreText only uses stable setters and the toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );
  const regeneration = useSectionRegeneration(periodId, props.regeneratingSectionIds, onRegenerationFinished);
  const decisions = useStatementDecisions({ toast, refresh });

  const claimsBySection = useMemo(() => {
    const map = new Map<string, InspectorClaim[]>();
    for (const c of props.claims) map.set(c.sectionId, [...(map.get(c.sectionId) ?? []), c]);
    return map;
  }, [props.claims]);

  const anchorsBySection = useMemo(
    () => new Map(sections.map((s) => [s.id, anchorClaims(s.content ?? "", claimsBySection.get(s.id) ?? [])] as const)),
    [sections, claimsBySection],
  );

  const verifiedTablesBySection = useMemo(
    () =>
      new Map(
        sections.map((s) => {
          const matches = matchVerifiedTables(s.content ?? "", props.artifacts[s.id] ?? []);
          return [
            s.id,
            {
              verified: new Set(matches.map((m) => m.tableIndex)),
              drifted: new Set(matches.filter((m) => m.changedNumbers > 0).map((m) => m.tableIndex)),
            },
          ] as const;
        }),
      ),
    [sections, props.artifacts],
  );

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
        commentCounts: props.commentCounts,
        inputsChanged: props.inputsChangedSince,
        staleSummaryIds: props.summaryStaleSectionIds,
        driftedTableSectionIds: sections.filter((s) => (verifiedTablesBySection.get(s.id)?.drifted.size ?? 0) > 0).map((s) => s.id),
        regeneratingSectionIds: [...regeneration.regeneratingIds],
        draftStatus: draft?.status ?? null,
        generating: generation.generating,
        readinessPercent: props.readinessPercent,
        capabilities: caps,
      }),
    [
      projectId,
      periodId,
      sections,
      props.claims,
      props.checklist,
      props.unverifiedIndicatorCount,
      props.sensitiveEvidenceCount,
      props.smartReviewItems,
      props.commentCounts,
      props.inputsChangedSince,
      props.summaryStaleSectionIds,
      verifiedTablesBySection,
      regeneration.regeneratingIds,
      draft?.status,
      generation.generating,
      props.readinessPercent,
      caps,
    ],
  );

  const selectedId = ui.section && sections.some((s) => s.id === ui.section) ? ui.section : (sections.find((s) => s.status !== "NOT_STARTED")?.id ?? null);
  const panel: InspectorPanel = ui.panel ?? "statements";
  const selectedVM = model.sections.find((s) => s.id === selectedId) ?? null;
  const selectedSection = sections.find((s) => s.id === selectedId) ?? null;
  const canAuthor = model.mode === "author" && model.phase === "DRAFT" && !generation.generating;
  const canRegenerate = canAuthor && caps.canGenerate;
  const base = `/projects/${projectId}/reports/${periodId}`;
  const inputsHref = `${base}/inputs`;
  const inputRows = buildReportInputRows({
    indicators: props.indicators,
    scope: props.reportScope,
    storyAnswered: props.storyAnsweredCount,
    evidenceCount: props.evidenceCount,
    inputsHref,
    activitiesHref: `/projects/${projectId}/activities`,
  });

  const issues = useMemo(() => {
    const open = props.claims
      .filter(isOpenStatement)
      .map((c) => ({ id: c.id, sectionId: c.sectionId, position: anchorsBySection.get(c.sectionId)?.get(c.id)?.start ?? null }));
    return buildIssueList(
      model.sections.map((s) => ({ id: s.id, needsRecheck: s.needsRecheck })),
      open,
    );
  }, [props.claims, anchorsBySection, model.sections]);
  const issueKey = currentIssueKey(issues, { claim: ui.claim, section: ui.section });
  const issuePosition = issueKey ? issues.findIndex((i) => i.key === issueKey) + 1 : 0;

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
    (sectionId: string, next?: { panel?: InspectorPanel; claim?: string; openInspector?: boolean }) => {
      updateUi({ section: sectionId, panel: next?.panel ?? (ui.panel === "checks" ? "statements" : ui.panel), claim: next?.claim });
      if (next?.openInspector && !wideLayout) setInspectorOpen(true);
      window.requestAnimationFrame(() =>
        document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    [ui.panel, updateUi, wideLayout],
  );

  function goToIssue(direction: 1 | -1) {
    const next = stepIssue(issues, issueKey, direction);
    if (!next) return;
    if (next.kind === "statement") goToSection(next.sectionId, { panel: "statements", claim: next.claimId, openInspector: true });
    else goToSection(next.sectionId, { panel: "statements", openInspector: true });
  }

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

  async function recheck(sectionIds: string[], key: string) {
    const ids = sectionIds.filter((id) => model.sections.find((s) => s.id === id)?.hasContent);
    if (ids.length === 0) return;
    setRecheckingKey(key);
    let failed = 0;
    for (const id of ids) {
      const result = await reassessSectionAction(id);
      if (!result.ok) failed += 1;
    }
    setRecheckingKey(null);
    toast.push(
      failed > 0
        ? { title: `${plural(failed, "section")} could not be re-checked. Try again.`, tone: "danger" }
        : { title: ids.length === 1 ? "Section re-checked against the latest evidence" : `${ids.length} sections re-checked`, tone: "success" },
    );
    router.refresh();
  }

  async function restoreText(sectionId: string, content: string, version: string) {
    const result = await updateReportSectionAction(sectionId, { content, expectedVersion: version, changeOrigin: "RESTORE" });
    if (!result.ok) {
      toast.push({ title: result.error.message, tone: "danger" });
      return false;
    }
    setOverrides((current) => ({ ...current, [sectionId]: { content, version: result.value.version } }));
    toast.push({ title: "Previous version restored", tone: "success" });
    router.refresh();
    return true;
  }

  async function restoreRevision(revision: SectionRevision) {
    if (!selectedSection) return;
    setRestoringId(revision.id);
    await restoreText(selectedSection.id, revision.content, selectedSection.updatedAt);
    setRestoringId(null);
  }

  function onCheck(check: ReportCheck) {
    if (check.target.kind === "claim") goToSection(check.target.sectionId, { panel: "statements", claim: check.target.claimId, openInspector: true });
    else if (check.target.kind === "section") goToSection(check.target.sectionId, { panel: check.target.panel ?? "statements", openInspector: true });
    else if (check.target.kind === "recheck") void recheck(check.target.sectionIds, check.id);
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

  async function approveAllClean() {
    const ids = model.approvableIds;
    setBusy("approve-all");
    let approved = 0;
    for (const id of ids) {
      const result = await approveReportSectionAction(id);
      if (!result.ok) {
        toast.push({ title: result.error.message, tone: "danger" });
        break;
      }
      approved += 1;
    }
    setBusy(null);
    if (approved > 0) toast.push({ title: `${plural(approved, "section")} approved`, tone: "success" });
    router.refresh();
  }

  function editSection(sectionId: string) {
    updateUi({ section: sectionId, panel: panel === "checks" ? "statements" : panel });
    setEditingId(sectionId);
  }

  function onPrimary() {
    const p = model.primary;
    switch (p.kind) {
      case "generate":
        void generation.generate();
        break;
      case "review-statements":
        goToSection(p.sectionId, { panel: "statements", claim: p.claimId, openInspector: true });
        break;
      case "approve-sections":
        goToSection(p.sectionId, { panel: "statements" });
        break;
      case "finish-checks":
        updateUi({ ...ui, panel: "checks" });
        if (!wideLayout) setInspectorOpen(true);
        break;
      case "submit":
        if (draft) void run("primary", () => submitReportForReviewAction(draft.id), "Report submitted for review");
        break;
      case "approve-report":
        setConfirm({ kind: "approve-report" });
        break;
      case "export":
        setExportOpen(true);
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

  /** Moves a section, with its sub-sections, past its previous/next sibling. */
  function moveSection(id: string, offset: -1 | 1) {
    if (!draft) return;
    const ids = moveWithSubtree(model.sections, id, offset);
    if (!ids) return;
    void run("reorder", () => reorderReportSectionsAction(draft.id, ids));
  }

  function toggleEvidenceMarks() {
    const next = !showEvidenceMarks;
    setShowEvidenceMarks(next);
    try {
      window.localStorage.setItem(EVIDENCE_MARKS_KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
  }

  function onShortcut(action: ShortcutAction) {
    const index = model.sections.findIndex((s) => s.id === selectedId);
    switch (action) {
      case "next-section":
      case "prev-section": {
        const step = action === "next-section" ? 1 : -1;
        const candidates = model.sections.filter((s) => !s.isWriting);
        const at = candidates.findIndex((s) => s.id === selectedId);
        const target = candidates[Math.min(candidates.length - 1, Math.max(0, (at === -1 ? (index === -1 ? -1 : 0) : at) + step))];
        if (target) goToSection(target.id);
        break;
      }
      case "next-issue":
        goToIssue(1);
        break;
      case "prev-issue":
        goToIssue(-1);
        break;
      case "edit":
        if (selectedVM && canAuthor && !selectedVM.isApproved && !selectedVM.regenerating) editSection(selectedVM.id);
        break;
      case "approve":
        if (selectedVM?.canApprove && !editingId) void approveSection(selectedVM.id);
        break;
      case "help":
        setShortcutsOpen(true);
        break;
    }
  }
  const hasDocument = Boolean(draft) && sections.length > 0;
  useEditorShortcuts(hasDocument && !editingId, onShortcut);

  const menuItems: MenuItem[] = [];
  if (caps.canGenerate && draft && !generation.generating && model.phase === "DRAFT") {
    menuItems.push({ label: "Regenerate whole draft", hint: "Creates a new version; this one stays in history", onSelect: () => setConfirm({ kind: "regenerate" }) });
  }
  menuItems.push({ label: "Edit data & story", hint: "Indicator values, story answers, imports", href: inputsHref });
  if (caps.canGenerate) {
    menuItems.push({
      label: "Scan for missing items",
      hint: "Check the report against the donor checklist",
      onSelect: () => void run("scan", () => detectMissingAction(periodId), "Scan finished — checks updated"),
    });
  }
  if (props.versions.length > 0) {
    menuItems.push({ label: "Version history", hint: plural(props.versions.length, "version"), onSelect: () => setVersionsOpen(true) });
  }
  if (hasDocument) {
    menuItems.push({ label: "Show evidence marks", hint: "Underline every statement that matches the evidence", checked: showEvidenceMarks, onSelect: toggleEvidenceMarks });
    menuItems.push({ label: "Keyboard shortcuts", hint: "Press ? at any time", onSelect: () => setShortcutsOpen(true) });
  }
  menuItems.push({ label: "Export center", hint: "Past exports and downloads", href: `${base}/export` });
  menuItems.push({ label: "Switch to classic view", hint: "The previous workspace layout", href: `${base}?editor=classic` });

  const approveBlocking = model.checks.filter((c) => c.severity === "BLOCKING").length;
  const inputsChanged = props.inputsChangedSince;
  const showBanner = hasDocument && !bannerDismissed && model.phase === "DRAFT" && inputsChanged !== null && (inputsChanged.indicators > 0 || inputsChanged.evidence > 0);
  const reviewer = model.phase === "UNDER_REVIEW" && caps.canApproveReport;

  const inspector = (
    <Inspector
      projectId={projectId}
      panel={panel}
      onPanel={(p) => updateUi({ ...ui, panel: p, claim: undefined })}
      section={selectedVM}
      sectionData={selectedSection}
      statements={{
        claims: selectedId ? (claimsBySection.get(selectedId) ?? []) : [],
        anchors: selectedId ? (anchorsBySection.get(selectedId) ?? NO_ANCHORS) : NO_ANCHORS,
        focusClaimId: ui.claim,
        canResolve: canResolveClaim && canAuthor,
        canCorrect: canAuthor && editingId !== selectedId && !selectedVM?.regenerating,
        correctBlockedReason: editingId === selectedId ? "Finish editing this section to use the evidence value." : undefined,
        canOverrideConfidential,
        busyClaimId: decisions.busyClaimId,
        rechecking: recheckingKey === `section-${selectedId}`,
        handlers: {
          onDecide: decisions.decide,
          onUndo: (claim) => void decisions.undo(claim.id),
          onUseEvidence: (claim, suggestion) => {
            const section = sections.find((s) => s.id === claim.sectionId);
            if (section) void decisions.applyEvidence(claim, suggestion, section.updatedAt);
          },
          onRecheck: () => {
            if (selectedId) void recheck([selectedId], `section-${selectedId}`);
          },
        },
      }}
      checks={model.checks}
      checkBusyId={recheckingKey}
      onCheck={onCheck}
      chartIndicators={chartIndicators}
      canEdit={canAuthor}
      restoringId={restoringId}
      onRestore={(revision) => void restoreRevision(revision)}
      onReload={refresh}
    />
  );

  const generationProgressKnown = generation.generating && model.sections.length > 0;
  return (
    <div className="animate-fade-in" data-tour-id="report-editor">
      <div className="flex justify-end">
        <HelpButton topic="report-editor" />
      </div>
      <AiActivityPopup
        open={generation.starting || generation.generating}
        title="Writing your report"
        steps={GENERATION_STEPS}
        progressPercent={generationProgressKnown ? (100 * generation.progress.done) / generation.progress.total : undefined}
        progressLabel={generationProgressKnown ? `${generation.progress.done} of ${generation.progress.total} sections` : undefined}
        estimatedMs={GENERATION_STARTING_ESTIMATED_MS}
        note={generation.progress.etaLabel ? `About ${generation.progress.etaLabel}.` : "This can take a few minutes for a full report — you can keep browsing other pages meanwhile."}
        variant="corner"
      />
      <EditorTopBar
        backHref={`/projects/${projectId}/reports`}
        eyebrow={props.heading.eyebrow}
        title={draft?.title ?? props.heading.title}
        draftStatus={draft?.status ?? null}
        version={draft?.version ?? null}
        saveStatus={editingId ? saveStatus : null}
        readinessPercent={model.readiness.percent}
        todo={model.readiness.todo}
        checksOpen={panel === "checks" && (wideLayout || inspectorOpen)}
        onOpenChecks={() => {
          updateUi({ ...ui, panel: panel === "checks" && (wideLayout || inspectorOpen) ? "statements" : "checks" });
          if (!wideLayout) setInspectorOpen(!(panel === "checks" && inspectorOpen));
        }}
        primary={hasDocument || model.primary.kind !== "generate" ? model.primary : { kind: "none" }}
        primaryPending={busy === "primary" || generation.starting}
        onPrimary={onPrimary}
        secondary={reviewer ? { label: "Request changes", onClick: () => setRequestChangesOpen(true) } : undefined}
        issues={{ position: issuePosition, total: issues.length, onPrev: () => goToIssue(-1), onNext: () => goToIssue(1) }}
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

      {(generation.message || generation.error || regeneration.error) && (
        <div
          role={generation.error || regeneration.error ? "alert" : "status"}
          className={`mt-4 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
            generation.error || regeneration.error
              ? "border-danger-500/30 bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400"
              : "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          }`}
        >
          <span>{generation.error ?? regeneration.error ?? generation.message}</span>
          {(generation.message || regeneration.error) && (
            <button
              type="button"
              onClick={() => {
                generation.clearMessage();
                regeneration.clearError();
              }}
              className="min-h-[32px] text-xs text-slate-500 hover:underline dark:text-slate-400"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {showBanner && inputsChanged && (
        <InputsChangedBanner
          indicators={inputsChanged.indicators}
          evidence={inputsChanged.evidence}
          sectionCount={inputsChanged.sectionIds.length}
          canRecheck={canAuthor}
          pending={recheckingKey === "inputs-banner"}
          onRecheck={() => {
            const ids = inputsChanged.sectionIds.length > 0 ? inputsChanged.sectionIds : model.sections.filter((s) => s.hasContent && !s.isApproved).map((s) => s.id);
            void recheck(ids, "inputs-banner").then(() => setBannerDismissed(true));
          }}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {!hasDocument ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-8 dark:border-white/10 dark:bg-slate-900/40">
          <GenerateLaunchCard
            rows={inputRows}
            canGenerate={caps.canGenerate}
            starting={generation.starting}
            onGenerate={() => void generation.generate()}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside className="hidden lg:block">
            <div className="sticky top-36 max-h-[calc(100vh-10rem)] space-y-4 overflow-y-auto pb-4 pr-1">
              <OutlineNav
                sections={model.sections}
                approvedCount={model.approvedCount}
                selectedId={selectedId}
                onSelect={(id) => goToSection(id)}
                canManage={canAuthor}
                busy={busy !== null}
                onAdd={addSection}
                onMove={moveSection}
                onDelete={(id, title) => setConfirm({ kind: "delete", id, title })}
                approvableCount={model.approvableIds.length}
                approvingAll={busy === "approve-all"}
                onApproveAllClean={canAuthor && caps.canApproveSection ? () => void approveAllClean() : undefined}
                footer={
                  <ReportInputsCard inputsHref={inputsHref} rows={inputRows} />
                }
              />
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 lg:hidden">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <span className="shrink-0 text-slate-600 dark:text-slate-300">Section</span>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => goToSection(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-white/15 dark:bg-slate-900"
                >
                  {model.sections.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.isWriting}>
                      {"\u00a0\u00a0".repeat(s.level - 1)}
                      {s.number} {s.title}
                      {s.isApproved ? " ✓" : s.openStatements > 0 ? ` (${s.openStatements} to decide)` : s.needsRecheck ? " (re-check)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!wideLayout && selectedVM && (
              <div className="sticky top-32 z-20 mb-3 flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => setInspectorOpen(true)}>
                  Section details{selectedVM.openStatements > 0 ? ` · ${selectedVM.openStatements} to decide` : ""}
                </Button>
              </div>
            )}
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
                    projectId={projectId}
                    vm={vm}
                    section={s}
                    artifacts={props.artifacts[s.id] ?? []}
                    chartIndicators={chartIndicators}
                    claims={claimsBySection.get(s.id) ?? []}
                    anchors={anchorsBySection.get(s.id) ?? NO_ANCHORS}
                    verifiedTables={verifiedTablesBySection.get(s.id)}
                    focusedClaimId={s.id === selectedId ? ui.claim : undefined}
                    showEvidenceMarks={showEvidenceMarks}
                    selected={s.id === selectedId}
                    editing={s.id === editingId}
                    canEdit={canAuthor}
                    canRegenerate={canRegenerate}
                    approving={busy === "approve-section"}
                    rechecking={recheckingKey === `section-${s.id}`}
                    regenerationPending={regeneration.starting === s.id}
                    onSelect={() => {
                      if (editingId && editingId !== s.id) setEditingId(null);
                      updateUi({ section: s.id, panel: panel === "checks" ? "statements" : panel });
                    }}
                    onEdit={() => editSection(s.id)}
                    onDoneEditing={() => {
                      setEditingId(null);
                      router.refresh();
                    }}
                    onApprove={() => void approveSection(s.id)}
                    onReload={() => {
                      setEditingId(null);
                      setOverrides((current) => {
                        const next = { ...current };
                        delete next[s.id];
                        return next;
                      });
                      router.refresh();
                    }}
                    onSaveStatus={setSaveStatus}
                    onSaved={(saved: RichEditorSaved) => setOverrides((current) => ({ ...current, [s.id]: { content: saved.content, version: saved.version } }))}
                    onNotice={(message) => toast.push({ title: message, tone: "warning" })}
                    onClaim={(claimId) => goToSection(s.id, { panel: "statements", claim: claimId, openInspector: true })}
                    onRecheck={() => void recheck([s.id], `section-${s.id}`)}
                    onRegenerate={(instruction) => regeneration.start(s.id, instruction, s.content ?? "")}
                  />
                );
              })}
            </article>
          </div>

          {wideLayout && (
            <aside className="min-w-0">
              <div className="xl:sticky xl:top-36 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto xl:pb-4">{inspector}</div>
            </aside>
          )}
        </div>
      )}

      {!wideLayout && hasDocument && (
        <Drawer
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          title={panel === "checks" || !selectedVM ? "Report checks" : `Section ${selectedVM.number} details`}
          side={largeLayout ? "right" : "bottom"}
          wide
        >
          {inspector}
        </Drawer>
      )}

      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete section?"
        message={
          confirm?.kind === "delete"
            ? `“${confirm.title}” and its checked statements will be removed from this draft. This cannot be undone.${
                model.sections.find((s) => s.id === confirm.id)?.hasChildren ? " Its sub-sections are kept and move up under the section before it." : ""
              }`
            : ""
        }
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

      <RequestChangesDialog
        open={requestChangesOpen}
        pending={busy === "request-changes"}
        onClose={() => setRequestChangesOpen(false)}
        onSubmit={(notes) => {
          if (!draft) return;
          void run("request-changes", () => requestChangesAction(draft.id, notes), "Report sent back to the writers").then((done) => {
            if (done !== undefined) setRequestChangesOpen(false);
          });
        }}
      />

      <ExportDialog
        open={exportOpen}
        projectId={projectId}
        periodId={periodId}
        canResolveClaim={canResolveClaim}
        canOverrideConfidential={canOverrideConfidential}
        onClose={() => setExportOpen(false)}
        onExported={() => {
          toast.push({ title: "Export created — find it in the Export center", tone: "success" });
          router.refresh();
        }}
      />

      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

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
    </div>
  );
}
