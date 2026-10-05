"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmIndicatorSemanticsAction } from "@/lib/actions/indicators";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/Toast";

/** Confirms the suggested calculation of the given indicators in one click. */
export function ConfirmSemanticsButton({ indicatorIds, label, size = "sm" }: { indicatorIds: string[]; label?: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (indicatorIds.length === 0) return null;

  async function confirm() {
    setBusy(true);
    try {
      const result = await confirmIndicatorSemanticsAction(indicatorIds);
      if (!result.ok) {
        toast.push({ title: "Could not confirm", description: result.error.message, tone: "danger" });
        return;
      }
      const { confirmed, failed } = result.value;
      if (failed.length > 0) {
        toast.push({
          title: `${confirmed.length} confirmed, ${failed.length} need a choice`,
          description: failed.map((f) => f.message).join(" "),
          tone: "warning",
        });
      } else {
        toast.push({ title: `${confirmed.length} calculation${confirmed.length === 1 ? "" : "s"} confirmed`, tone: "success" });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size={size} pending={busy} onClick={() => void confirm()}>
      {label ?? (indicatorIds.length === 1 ? "Confirm calculation" : `Confirm all (${indicatorIds.length})`)}
    </Button>
  );
}
