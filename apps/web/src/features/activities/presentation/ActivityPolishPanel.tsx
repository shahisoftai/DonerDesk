"use client";

import { useState } from "react";
import { polishActivityAction } from "@/lib/actions/activities";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";

type PolishState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "suggested"; narrative: string; model: string }
  | { kind: "error"; message: string };

export function ActivityPolishPanel({
  activityId,
  originalSummary,
  existingNarrative,
  demoMode,
}: {
  activityId: string;
  originalSummary: string;
  existingNarrative?: string;
  demoMode: boolean;
}) {
  const actionState = useActionState();
  const [state, setState] = useState<PolishState>(
    existingNarrative ? { kind: "suggested", narrative: existingNarrative, model: "stored" } : { kind: "idle" },
  );
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState({ kind: "loading" });
    const result = await actionState.run(() => polishActivityAction(activityId));
    if (!result) {
      setState({ kind: "error", message: actionState.error ?? "Could not generate a narrative." });
      return;
    }
    setState({ kind: "suggested", narrative: result.narrative, model: result.model });
  }

  function useNarrative() {
    if (state.kind !== "suggested") return;
    void navigator.clipboard?.writeText(state.narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section aria-labelledby="polish-title" className="rounded-xl border border-ai-500/30 bg-ai-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="polish-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          AI writing assistance
        </h2>
        {demoMode && (
          <span className="rounded-full border border-ai-500/30 bg-ai-500/10 px-2 py-0.5 text-xs font-medium text-ai-700 dark:text-ai-400">
            Demo mode
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        An AI suggestion is generated from your field notes and stored on this record. It never overwrites your original
        summary.
      </p>

      {state.kind === "idle" && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={generate} pending={actionState.busy}>
          Polish with AI
        </Button>
      )}

      {state.kind === "loading" && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Generating…</p>}

      {state.kind === "error" && (
        <div className="mt-3">
          <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">
            {state.message}
          </p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={generate}>
            Try again
          </Button>
        </div>
      )}

      {state.kind === "suggested" && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Your original summary</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white/50 p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200">
              {originalSummary || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Suggested narrative</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-ai-500/30 bg-ai-500/5 p-3 text-sm text-slate-700 dark:text-slate-200">
              {state.narrative}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={useNarrative}>
                {copied ? "Copied" : "Copy for your notes"}
              </Button>
              <Button size="sm" variant="secondary" onClick={generate} pending={actionState.busy}>
                Try again
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setState({ kind: "idle" })}>
                Keep original
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
