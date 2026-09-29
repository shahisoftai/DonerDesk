"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDemoProjectAction } from "@/lib/actions/demo-project";
import { useToast } from "@/components/feedback/Toast";

export function DeleteDemoProjectButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const toast = useToast();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-danger-600 hover:underline dark:text-danger-400"
      >
        Delete demo project
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-600 dark:text-slate-300">Delete this demo project and everything in it?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteDemoProjectAction(projectId);
            if (!result.ok) {
              toast.push({ title: result.error.message, tone: "danger" });
              return;
            }
            toast.push({ title: "Demo project deleted", tone: "success" });
            router.push("/dashboard");
          })
        }
        className="font-medium text-danger-600 hover:underline dark:text-danger-400 disabled:opacity-60"
      >
        {pending ? "Deleting..." : "Confirm"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-slate-500 hover:underline dark:text-slate-400">
        Cancel
      </button>
    </div>
  );
}
