import { buildReportChecks, openClaimsInOrder, type ChecksInput, type ReportCheck } from "./report-checks.ts";
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
  openStatements: number;
  canApprove: boolean;
  /** Why "Approve section" is unavailable, in plain language. */
  approveBlockedReason?: string;
};

export type EditorModel = {
  phase: EditorPhase;
  mode: "author" | "reviewer" | "readonly";
  sections: SectionVM[];
  approvedCount: number;
  checks: ReportCheck[];
  readiness: { percent: number; todo: number };
  primary: PrimaryAction;
};

export type EditorModelInput = Omit<ChecksInput, "sections"> & {
  sections: ReadonlyArray<{ id: string; sectionTitle: string; status: string }>;
  draftStatus: string | null;
  generating: boolean;
  readinessPercent: number;
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

  const sections: SectionVM[] = input.sections.map((s, i) => {
    const isApproved = s.status === "APPROVED";
    const isWriting = s.status === "NOT_STARTED";
    const openStatements = openBySection.get(s.id) ?? 0;
    let approveBlockedReason: string | undefined;
    if (!caps.canApproveSection) approveBlockedReason = "You do not have permission to approve sections.";
    else if (phase !== "DRAFT") approveBlockedReason = "Sections can only be approved while the report is a draft.";
    else if (isWriting) approveBlockedReason = "This section is still being written.";
    else if (openStatements > 0)
      approveBlockedReason = `Decide on ${openStatements === 1 ? "the flagged statement" : `the ${openStatements} flagged statements`} first.`;
    return {
      id: s.id,
      number: i + 1,
      title: s.sectionTitle,
      status: s.status,
      isApproved,
      isWriting,
      openStatements,
      canApprove: !isApproved && approveBlockedReason === undefined,
      approveBlockedReason: isApproved ? undefined : approveBlockedReason,
    };
  });

  const checks = phase === "EMPTY" ? [] : buildReportChecks({ ...input, sections: input.sections });
  const unapprovedSectionCount = sections.filter((s) => !s.isApproved && !s.isWriting).length;
  const primary = nextPrimaryAction({
    phase,
    canGenerate: caps.canGenerate,
    canEdit: caps.canEdit,
    canApprove: caps.canApproveReport,
    canExport: caps.canExport,
    checks,
    unapprovedSectionCount,
    openStatementCount: openClaims.length,
  });

  return {
    phase,
    mode,
    sections,
    approvedCount: sections.filter((s) => s.isApproved).length,
    checks,
    readiness: {
      percent: Math.max(0, Math.min(100, Math.round(input.readinessPercent))),
      todo: checks.length,
    },
    primary,
  };
}
