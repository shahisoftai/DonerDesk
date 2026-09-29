"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDemoProjectAction } from "@/lib/actions/demo-project";
import { useTourProgress } from "./useTourProgress";
import { useToast } from "@/components/feedback/Toast";

/**
 * Shared by every entry point that launches or resumes the DonorDesk Academy
 * tour (dashboard card, project setup aside, header button) so "start" means
 * the same thing everywhere: create-or-reuse the tenant's demo project, mark
 * the tour active, and land on that project. Factored out so a header button
 * clicked from any page in the app does the real thing, not just a link to
 * wherever the tour happens to already be surfaced.
 */
export function useStartOrResumeTour() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { start } = useTourProgress();
  const router = useRouter();
  const toast = useToast();

  const startOrResumeTour = () => {
    setError(null);
    startTransition(async () => {
      const result = await createDemoProjectAction();
      if (!result.ok) {
        setError(result.error.message);
        toast.push({ title: result.error.message, tone: "danger" });
        return;
      }
      if (result.value.reused) {
        toast.push({ title: "Resuming your demo project", tone: "info" });
      }
      start();
      router.push(`/projects/${result.value.id}`);
    });
  };

  return { startOrResumeTour, pending, error };
}
