"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  pending?: boolean;
}) {
  const [localPending, setLocalPending] = useState(false);
  const isPending = pending ?? localPending;

  return (
    <Dialog open={open} onClose={isPending ? () => undefined : onClose} title={title}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant={tone}
          pending={isPending}
          onClick={async () => {
            if (pending === undefined) setLocalPending(true);
            try {
              await onConfirm();
            } finally {
              setLocalPending(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
