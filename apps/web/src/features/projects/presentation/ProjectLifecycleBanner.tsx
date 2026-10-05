"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { describeProjectLifecycle } from "@donordesk/domain/contexts/projects/project-lifecycle.js";
import { updateProjectAction, restoreProjectAction } from "@/lib/actions/projects";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { Button } from "@/components/ui/Button";

/**
 * States, in the project header, what the project's status means and the one step to continue
 * ("Draft — activate to report"). Hidden for an active project. The button only shows to people
 * who may edit the project; others read the same sentence without it.
 */
export function ProjectLifecycleBanner({ projectId, status, canEdit }: { projectId: string; status: string; canEdit: boolean }) {
  const router = useRouter();
  const view = describeProjectLifecycle(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status === "ACTIVE") return null;

  async function run() {
    if (!view.action) return;
    setBusy(true);
    setError(null);
    try {
      const result = view.action.kind === "RESTORE" ? await restoreProjectAction(projectId) : await updateProjectAction(projectId, { status: "ACTIVE" });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <InlineAlert tone={view.tone} title={view.label} className="mt-3">
      <p>{view.explanation}</p>
      {view.action && canEdit && (
        <div className="mt-2">
          <Button size="sm" pending={busy} onClick={() => void run()}>{view.action.label}</Button>
        </div>
      )}
      {view.action && !canEdit && <p className="mt-1 text-xs">Ask a project owner to do this.</p>}
      {error && <p role="alert" className="mt-2 text-sm font-medium">{error}</p>}
    </InlineAlert>
  );
}
