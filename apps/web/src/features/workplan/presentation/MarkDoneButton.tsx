"use client";

import { Button } from "@/components/ui/Button";
import { useRecordSheet } from "@/features/record/presentation/RecordHost";

/**
 * "Done" on a planned item. It opens the Record sheet on that item's "What happened?" question, the one place that carries every
 * answer (finished, some progress, did not happen) through the existing actions; nothing is saved from here.
 */
export function MarkDoneButton({ projectId, itemId, size = "sm", label = "Done" }: { projectId: string; itemId: string; size?: "sm" | "md"; label?: string }) {
  const record = useRecordSheet();
  return <Button size={size === "md" ? "md" : "touch"} onClick={() => record.open({ projectId, kind: "ACTIVITY", plannedActivityId: itemId })}>{label}</Button>;
}
