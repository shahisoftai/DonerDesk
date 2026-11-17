/**
 * "What's next" for a person on a project (Phase 59): one sentence and one link at the top of the Overview. It is read from what already
 * waits on them (the "Needs you" queue, most pressing first); with nothing waiting it offers the one setup step the person may do, or
 * nothing at all. Pure: it reads, it never writes, and it holds no clock.
 */
export interface NextStepSource { title: string; href: string; urgent: boolean }
export interface NextStepInput {
  needsYou: readonly NextStepSource[];
  hasPeriods: boolean;
  /** The person may create a reporting period (the same capability that guards the page). */
  canCreatePeriod: boolean;
  projectId: string;
}
export interface NextStep { text: string; href: string; urgent: boolean; others: number; action: "OPEN" | "CREATE_PERIOD" }

export function nextStep(input: NextStepInput): NextStep | null {
  const first = input.needsYou.find((i) => i.urgent) ?? input.needsYou[0];
  if (first) return { text: first.title, href: first.href, urgent: first.urgent, others: input.needsYou.length - 1, action: "OPEN" };
  if (!input.hasPeriods && input.canCreatePeriod) {
    return { text: "Create the first reporting period to start collecting values for a report.", href: `/projects/${input.projectId}/reports/new`, urgent: false, others: 0, action: "CREATE_PERIOD" };
  }
  return null;
}
