"use client";

import { Dialog } from "@/components/feedback/Dialog";
import { ExportWizard } from "@/features/exports/presentation/ExportWizard";

/** "Export report" from the primary action (Report Editor U16). */
export function ExportDialog({
  open,
  projectId,
  periodId,
  canResolveClaim,
  canOverrideConfidential,
  onClose,
  onExported,
}: {
  open: boolean;
  projectId: string;
  periodId: string;
  canResolveClaim: boolean;
  canOverrideConfidential: boolean;
  onClose: () => void;
  onExported: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Export report" size="lg">
      {open && (
        <ExportWizard
          projectId={projectId}
          periodId={periodId}
          canResolveClaim={canResolveClaim}
          canOverrideConfidential={canOverrideConfidential}
          onClose={onClose}
          onExported={onExported}
        />
      )}
    </Dialog>
  );
}
