"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { rewriteSelectionPreviewAction } from "@/lib/actions/reporting";
import { fallbackReasonCopy } from "@/lib/reporting-copy";

export type AskAiMode = "rewrite" | "shorten" | "donor" | "expand";

const MODES: ReadonlyArray<{ id: AskAiMode; label: string }> = [
  { id: "rewrite", label: "Rewrite" },
  { id: "shorten", label: "Shorten" },
  { id: "donor", label: "Make donor-friendly" },
  { id: "expand", label: "Expand" },
];

/** How each "Ask AI" choice maps onto the rewrite endpoint. */
export const ASK_AI_REQUEST: Record<AskAiMode, { mode: "REWRITE" | "SHORTEN"; audience: "DONOR" | "INTERNAL" | "GENERAL"; instructions?: string }> = {
  rewrite: { mode: "REWRITE", audience: "DONOR" },
  shorten: { mode: "SHORTEN", audience: "DONOR" },
  donor: { mode: "REWRITE", audience: "DONOR", instructions: "Make it donor-friendly: plain, specific, results-focused language; no jargon." },
  expand: {
    mode: "REWRITE",
    audience: "DONOR",
    instructions: "Expand it with more explanation and context, using only facts already in the section. Do not add numbers.",
  },
};

export type AskAiSelection = {
  /** The selected text as the user sees it. */
  text: string;
  /** Range of the selection in the section's saved markdown. */
  markdown: { from: number; to: number };
};

/**
 * "Ask AI" on the selected text (Report Editor U28): the AI's version is
 * shown next to the original (struck through) and is applied only when the
 * user accepts it — never silently.
 */
export function AskAiPanel({
  sectionId,
  prepare,
  onAccept,
  onClose,
}: {
  sectionId: string;
  /** Saves pending text, then resolves the selection (or an error message). */
  prepare: () => Promise<AskAiSelection | string>;
  /** Applies the suggestion; returns an error message when it can't. */
  onAccept: (suggestion: string) => string | null;
  onClose: () => void;
}) {
  const [running, setRunning] = useState<AskAiMode | null>(null);
  const [result, setResult] = useState<{ original: string; suggestion: string; notice?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(mode: AskAiMode) {
    setRunning(mode);
    setError(null);
    try {
      const selection = await prepare();
      if (typeof selection === "string") {
        setError(selection);
        return;
      }
      const response = await rewriteSelectionPreviewAction(sectionId, { ...ASK_AI_REQUEST[mode], selection: selection.markdown });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setResult({
        original: selection.text,
        suggestion: response.value.content,
        notice: response.value.fallbackUsed ? fallbackReasonCopy(response.value.fallbackReason) : undefined,
      });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div role="region" aria-label="Ask AI about the selected text" className="rounded-lg border border-ai-500/30 bg-ai-50/60 p-3 font-sans text-sm dark:bg-ai-500/5">
      {!result ? (
        <>
          <p className="font-medium text-slate-800 dark:text-slate-100">Ask AI about the selected text</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <Button key={m.id} size="sm" variant="secondary" pending={running === m.id} disabled={running !== null} onClick={() => void ask(m.id)}>
                {m.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={onClose} disabled={running !== null}>
              Cancel
            </Button>
          </div>
          {running && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">Asking the AI… this can take up to a minute.</p>}
        </>
      ) : (
        <>
          <p className="font-medium text-slate-800 dark:text-slate-100">Suggested change</p>
          {result.notice && <p className="mt-1 text-xs text-warning-700 dark:text-warning-400">{result.notice}</p>}
          <div className="mt-2 space-y-1.5 font-serif text-[15px] leading-relaxed">
            <p>
              <span className="sr-only">Current text: </span>
              <del className="text-slate-500 decoration-danger-500/70 dark:text-slate-400">{result.original}</del>
            </p>
            <p>
              <span className="sr-only">Suggested text: </span>
              <ins className="bg-success-50 text-slate-800 no-underline dark:bg-success-500/10 dark:text-slate-100">{result.suggestion}</ins>
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const problem = onAccept(result.suggestion);
                if (problem) setError(problem);
                else onClose();
              }}
            >
              Accept
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Discard
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-700 dark:text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}
