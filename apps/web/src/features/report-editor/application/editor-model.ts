import { buildReportChecks, openClaimsInOrder, sectionsNeedingRecheck, type ChecksInput, type ReportCheck } from "./report-checks.ts";
import { nextPrimaryAction, type EditorPhase, type PrimaryAction } from "./primary-action.ts";

/**
 * Single derived view model for the document-first report editor. Every
 * count, label and flag the UI shows is computed here once, so the top bar,
 * outline, document and inspector can never disagree with each other.
 */

export type SectionVM = {
  id: string;
  number: number;
  title: string;
  status: string;
  isApproved: boolean;
  isWriting: boolean;
  hasContent: boolean;
  openStatements: number;
  /** Changed since it was checked; a re-check must run before approval. */
  needsRecheck: boolean;
  /** The AI is rewriting this section right now. */
  regenerating: boolean;
  /** Executive summary / conclusion older than a substantial change elsewhere. */
  summaryStale: boolean;
  commentCount: number;
  canApprove: boolean;
  /** Why "Approve section" is unavailable, in plain language. */
  approveBlockedReason?: string;
};

export type EditorModel = {
  phase: EditorPhase;
  mode: "author" | "reviewer" | "readonly";
  sections: SectionVM[];
  approvedCount: number;
  /** Sections that can be approved right now (for "Approve all clean"). */
  approvableIds: string[];
  checks: ReportCheck[];
  readiness: { percent: number; todo: number };
  primary: PrimaryAction;
};

export type EditorModelInput = Omit<ChecksInput, "sections"> & {
  sections: ReadonlyArray<{ id: string; sectionTitle: string; status: string; content?: string; assuranceState?: string | null }>;
  draftStatus: string | null;
  generating: boolean;
  readinessPercent: number;
  regeneratingSectionIds?: ReadonlyArray<string>;
  capabilities: {
    canGenerate: boolean;
    canEdit: boolean;
    canApproveSection: boolean;
    canApproveReport: boolean;
    canExport: boolean;
  };
};

export function editorPhase(draftStatus: string | null, generating: boolean): EditorPhase {
  if (generating) return "GENERATING";
  if (!draftStatus) return "EMPTY";
  if (draftStatus === "DRAFT") return "DRAFT";
  if (draftStatus === "UNDER_REVIEW") return "UNDER_REVIEW";
  return "APPROVED";
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function buildEditorModel(input: EditorModelInput): EditorModel {
  const phase = editorPhase(input.draftStatus, input.generating);
  const caps = input.capabilities;
  const mode: EditorModel["mode"] =
    (phase === "DRAFT" || phase === "EMPTY" || phase === "GENERATING") && caps.canEdit
      ? "author"
      : phase === "UNDER_REVIEW" && caps.canApproveReport
        ? "reviewer"
        : "readonly";

  const openClaims = openClaimsInOrder(input.sections, input.claims);
  const openBySection = new Map<string, number>();
  for (const c of openClaims) openBySection.set(c.sectionId, (openBySection.get(c.sectionId) ?? 0) + 1);
  const recheckIds = new Set(sectionsNeedingRecheck(input.sections, new Set(openBySection.keys())).map((s) => s.id));
  const regenerating = new Set(input.regeneratingSectionIds ?? []);
  const stale = new Set(input.staleSummaryIds ?? []);

  const sections: SectionVM[] = input.sections.map((s, i) => {
    const isApproved = s.status === "APPROVED";
    const isWriting = s.status === "NOT_STARTED";
    const hasContent = s.content === undefined ? true : s.content.trim().length > 0;
    const openStatements = openBySection.get(s.id) ?? 0;
    const needsRecheck = recheckIds.has(s.id);
    let approveBlockedReason: string | undefined;
    if (!caps.canApproveSection) approveBlockedReason = "You do not have permission to approve sections.";
    else if (phase !== "DRAFT") approveBlockedReason = "Sections can only be approved while the report is a draft.";
    else if (isWriting) approveBlockedReason = "This section is still being written.";
    else if (regenerating.has(s.id)) approveBlockedReason = "This section is being rewritten.";
    else if (!hasContent) approveBlockedReason = "Write this section before approving it.";
    else if (openStatements > 0)
      approveBlockedReason = `Decide on ${openStatements === 1 ? "the flagged statement" : `the ${plural(openStatements, "flagged statement")}`} first.`;
    else if (needsRecheck) approveBlockedReason = "Re-check this section before approving it.";
    return {
      id: s.id,
      number: i + 1,
      title: s.sectionTitle,
      status: s.status,
      isApproved,
      isWriting,
      hasContent,
      openStatements,
      needsRecheck,
      regenerating: regenerating.has(s.id),
      summaryStale: stale.has(s.id),
      commentCount: input.commentCounts?.[s.id] ?? 0,
      canApprove: !isApproved && approveBlockedReason === undefined,
      approveBlockedReason: isApproved ? undefined : approveBlockedReason,
    };
  });

  const checks = phase === "EMPTY" ? [] : buildReportChecks({ ...input, sections: input.sections });
  const unapprovedSectionCount = sections.filter((s) => !s.isApproved && !s.isWriting).length;
  const approvableIds = sections.filter((s) => s.canApprove).map((s) => s.id);
  const primary = nextPrimaryAction({
    phase,
    canGenerate: caps.canGenerate,
    canEdit: caps.canEdit,
    canApprove: caps.canApproveReport,
    canExport: caps.canExport,
    checks,
    unapprovedSectionCount,
    nextApprovableSectionId: approvableIds[0],
    openStatementCount: openClaims.length,
  });

  return {
    phase,
    mode,
    sections,
    approvedCount: sections.filter((s) => s.isApproved).length,
    approvableIds,
    checks,
    readiness: {
      percent: Math.max(0, Math.min(100, Math.round(input.readinessPercent))),
      todo: checks.length,
    },
    primary,
  };
}
