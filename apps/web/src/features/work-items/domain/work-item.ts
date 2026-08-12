export type WorkItemType = "report" | "checklist" | "evidence" | "activity" | "notification";

export type WorkItem =
  | {
      kind: "report";
      id: string;
      projectId: string;
      projectTitle: string;
      periodId: string;
      periodStatus: string;
      deadline: string | null;
      daysUntilDeadline: number | null;
      urgency: number | null;
    }
  | {
      kind: "checklist";
      id: string;
      projectId: string;
      projectTitle: string;
      periodId: string;
      severity: string;
      title: string;
      dueDate: string | null;
      daysUntilDeadline: number | null;
      urgency: number | null;
    }
  | {
      kind: "evidence";
      id: string;
      projectId: string;
      projectTitle: string;
      fileName: string;
      verificationStatus: string;
      urgency: number;
    }
  | {
      kind: "activity";
      id: string;
      projectId: string;
      projectTitle: string;
      activityTitle: string;
      status: string;
      urgency: number;
    }
  | {
      kind: "notification";
      id: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
      urgency: number;
    };

export function urgencyOf(days: number | null | undefined, base: number): number {
  if (days === null || days === undefined) return base + 100;
  if (days < 0) return 0;
  return days + 1;
}

export function compareUrgency(a: WorkItem, b: WorkItem): number {
  return (a.urgency ?? Infinity) - (b.urgency ?? Infinity);
}
