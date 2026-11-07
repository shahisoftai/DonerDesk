"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useState } from "react";
import { draftCanvasTextAction } from "@/lib/actions/canvas-publishing";

interface Props { style: string; projectId: string | undefined; instruction: string | undefined; language: string; disabled: boolean; /** The proposal arrives as an unaccepted draft in the block's text. */ onDraft: (text: string) => void }

/** Asks for a draft of an AI block's words. When drafting is off for the organisation it says so in one sentence; nothing is written until a person accepts. */
export function AiDraftControl({ style, projectId, instruction, language, disabled, onDraft }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<{ tone: "ok" | "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function draft(): Promise<void> {
    if (!projectId) { setState({ tone: "info", text: "Choose the project this canvas is about first." }); return; }
    setBusy(true); setState(null);
    const r = await draftCanvasTextAction({ style, projectId, language, ...(instruction?.trim() ? { instruction: instruction.trim() } : {}) });
    setBusy(false);
    if (!r.ok) { setState({ tone: "error", text: r.error.message }); return; }
    if (!r.value.available) { setState({ tone: "info", text: r.value.reason }); return; }
    onDraft(r.value.text);
    setState({ tone: "ok", text: `${r.value.note}${r.value.dropped > 0 ? ` ${r.value.dropped} sentence${r.value.dropped === 1 ? "" : "s"} with figures the records do not hold ${r.value.dropped === 1 ? "was" : "were"} left out.` : ""}` });
  }

  return (
    <div className="space-y-1">
      <button type="button" disabled={disabled || busy} onClick={() => void draft()} data-testid="ai-draft" className="rounded border border-sky-600 px-2 py-1 text-xs text-sky-800 hover:bg-sky-50 disabled:opacity-40 dark:text-sky-300 dark:hover:bg-slate-800">{busy ? t("canvas.ui.saving") : t("canvas.ui.draftFromRecords")}</button>
      {state && <p role={state.tone === "error" ? "alert" : "status"} className={`text-xs ${state.tone === "error" ? "text-red-700" : "text-slate-600 dark:text-slate-300"}`}>{state.text}</p>}
    </div>
  );
}
