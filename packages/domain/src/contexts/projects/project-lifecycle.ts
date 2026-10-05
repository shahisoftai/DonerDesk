/**
 * What a project's lifecycle state means for the person looking at it, and the one next step.
 * Pure (no imports) so the server header and any client component can share it.
 */
export type LifecycleTone = "info" | "warning" | "neutral";

export interface ProjectLifecycleView {
  /** Short headline for the project header, e.g. "Draft — activate to report". */
  label: string;
  tone: LifecycleTone;
  /** One sentence on what this state means. */
  explanation: string;
  /** The single next step, when there is one a person can take from here. */
  action?: { kind: "ACTIVATE" | "RESTORE"; label: string };
}

export function describeProjectLifecycle(status: string): ProjectLifecycleView {
  switch (status) {
    case "DRAFT":
      return {
        label: "Draft — activate to report",
        tone: "warning",
        explanation: "A new project starts as a draft. Activate it when its set-up is done and you are ready to report.",
        action: { kind: "ACTIVATE", label: "Activate project" },
      };
    case "PAUSED":
      return {
        label: "Paused — resume to report",
        tone: "warning",
        explanation: "Work on this project is on hold. Resume it to continue reporting.",
        action: { kind: "ACTIVATE", label: "Resume project" },
      };
    case "COMPLETED":
      return { label: "Completed — no new reports", tone: "neutral", explanation: "This project is finished; it takes no new reporting periods." };
    case "ARCHIVED":
      return {
        label: "Archived — restore to continue",
        tone: "neutral",
        explanation: "Archived projects are read-only and take no new reports.",
        action: { kind: "RESTORE", label: "Restore project" },
      };
    default:
      return { label: "Active", tone: "info", explanation: "This project is open for reporting." };
  }
}
