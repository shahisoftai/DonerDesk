"use client";

import { useState } from "react";
import { rewriteReportSectionAction } from "@/lib/actions/reporting";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { fallbackReasonCopy } from "@/lib/reporting-copy";

/**
 * Whole-section AI rewrite (clarity / shorten, audience). The server writes a
 * new revision; the caller reloads to show it. Selection-level "Ask AI" is P4.
 */
export function AiRewritePanel({ sectionId, onApplied, onClose }: { sectionId: string; onApplied: (notice?: string) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"REWRITE" | "SHORTEN">("REWRITE");
  const [audience, setAudience] = useState<"DONOR" | "INTERNAL" | "GENERAL">("DONOR");
  const [instructions, setInstructions] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    const result = await rewriteReportSectionAction(sectionId, { mode, audience, ...(instructions.trim() ? { instructions: instructions.trim() } : {}) });
    setRunning(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onApplied(
      result.value.fallbackUsed
        ? `${fallbackReasonCopy(result.value.fallbackReason)} Only simple tone and casing changes were applied.`
        : undefined,
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-ai-500/30 bg-ai-50/60 p-3 dark:bg-ai-500/5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What to do" htmlFor={`rewrite-mode-${sectionId}`}>
          <Select id={`rewrite-mode-${sectionId}`} value={mode} onChange={(e) => setMode(e.target.value as "REWRITE" | "SHORTEN")}>
            <option value="REWRITE">Rewrite for clarity</option>
            <option value="SHORTEN">Shorten</option>
          </Select>
        </Field>
        <Field label="Written for" htmlFor={`rewrite-audience-${sectionId}`}>
          <Select id={`rewrite-audience-${sectionId}`} value={audience} onChange={(e) => setAudience(e.target.value as "DONOR" | "INTERNAL" | "GENERAL")}>
            <option value="DONOR">The donor</option>
            <option value="INTERNAL">Internal readers</option>
            <option value="GENERAL">A general audience</option>
          </Select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Specific change (optional)" htmlFor={`rewrite-instructions-${sectionId}`} description="For example: replace “beneficiaries” with “people reached”, or say that the work finished in August.">
          <Textarea
            id={`rewrite-instructions-${sectionId}`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={1000}
            rows={2}
            disabled={running}
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600 dark:text-slate-300">Keeps your facts and sources. Can take up to three minutes. The current text stays in the section history.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={running}>
            Cancel
          </Button>
          <Button size="sm" onClick={run} pending={running}>
            {running ? "Rewriting…" : "Rewrite"}
          </Button>
        </div>
      </div>
    </div>
  );
}
