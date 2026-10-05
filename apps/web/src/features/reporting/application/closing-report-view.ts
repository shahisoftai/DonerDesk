/** Pure helpers for the closing-report stepper (unit-testable with node --test). */

export type ClosingStepStatus = "DONE" | "TODO" | "AFTER_START" | "BLOCKED";

const STATUS_LABEL: Record<ClosingStepStatus, string> = {
  DONE: "Done",
  TODO: "To do",
  AFTER_START: "After you start",
  BLOCKED: "Not possible",
};

export function closingStatusLabel(status: string): string {
  return STATUS_LABEL[status as ClosingStepStatus] ?? "To do";
}

/** Where each step's button goes. The final report's own pages are used once it exists. */
export function closingActionHref(kind: string, projectId: string, finalPeriodId?: string): string {
  switch (kind) {
    case "OPEN_LOGFRAME": return `/projects/${projectId}/logframe`;
    case "OPEN_REPORTS": return `/projects/${projectId}/reports`;
    case "OPEN_INPUTS": return finalPeriodId ? `/projects/${projectId}/reports/${finalPeriodId}/inputs` : `/projects/${projectId}/reports`;
    case "OPEN_ACTIVITIES": return `/projects/${projectId}/activities`;
    case "OPEN_TEMPLATES": return `/projects/${projectId}/templates`;
    case "OPEN_TEAM": return `/projects/${projectId}/team`;
    case "OPEN_SETTINGS": return `/projects/${projectId}/settings`;
    default: return `/projects/${projectId}/reports`;
  }
}

export function closingSummary(todoCount: number, canStart: boolean, finalExists: boolean): string {
  if (finalExists) return "The closing report has been started.";
  if (!canStart) return "The closing report cannot be started yet.";
  if (todoCount === 0) return "Everything is ready. Start the closing report.";
  return `${todoCount} thing${todoCount === 1 ? "" : "s"} to sort out first. You can still start now and finish them as you go.`;
}
