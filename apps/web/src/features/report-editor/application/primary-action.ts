import type { ReportCheck } from "./report-checks.ts";

/**
 * The single "next step" button in the editor's top bar. Its label follows
 * the workflow (generate → fix statements → approve sections → finish checks
 * → submit → approve → export). The server stays authoritative for every
 * gate; this only decides what to *suggest*.
 */

export type EditorPhase = "EMPTY" | "GENERATING" | "DRAFT" | "UNDER_REVIEW" | "APPROVED";

export type PrimaryAction =
  | { kind: "none" }
  | { kind: "generate"; label: string }
  | { kind: "review-statements"; label: string; sectionId: string; claimId: string }
  | { kind: "approve-sections"; label: string; sectionId: string }
  | { kind: "finish-checks"; label: string }
  | { kind: "submit"; label: string }
  | { kind: "approve-report"; label: string }
  | { kind: "waiting"; label: string }
  | { kind: "export"; label: string };

export type PrimaryActionInput = {
  phase: EditorPhase;
  canGenerate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canExport: boolean;
  checks: ReadonlyArray<ReportCheck>;
  /** Unapproved section count (excludes sections still being written). */
  unapprovedSectionCount: number;
  openStatementCount: number;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function nextPrimaryAction(input: PrimaryActionInput): PrimaryAction {
  switch (input.phase) {
    case "GENERATING":
      return { kind: "none" };
    case "EMPTY":
      return input.canGenerate ? { kind: "generate", label: "Generate report" } : { kind: "none" };
    case "DRAFT": {
      if (!input.canEdit) return { kind: "none" };
      const statements = input.checks.find((c) => c.id === "statements");
      if (input.openStatementCount > 0 && statements?.target.kind === "claim") {
        return {
          kind: "review-statements",
          label: `Review ${plural(input.openStatementCount, "flagged statement")}`,
          sectionId: statements.target.sectionId,
          claimId: statements.target.claimId,
        };
      }
      const sections = input.checks.find((c) => c.id === "sections");
      if (input.unapprovedSectionCount > 0 && sections?.target.kind === "section") {
        return {
          kind: "approve-sections",
          label: `Approve ${plural(input.unapprovedSectionCount, "remaining section")}`,
          sectionId: sections.target.sectionId,
        };
      }
      const otherBlocking = input.checks.filter((c) => c.severity === "BLOCKING" && c.id !== "statements" && c.id !== "sections").length;
      if (otherBlocking > 0) return { kind: "finish-checks", label: `Finish ${plural(otherBlocking, "remaining check")}` };
      return { kind: "submit", label: "Submit for review" };
    }
    case "UNDER_REVIEW":
      return input.canApprove ? { kind: "approve-report", label: "Approve report" } : { kind: "waiting", label: "Waiting for review" };
    case "APPROVED":
      return input.canExport ? { kind: "export", label: "Export report" } : { kind: "none" };
  }
}
