"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { studio, type AiText, type Suggestions } from "../../domain/studio-api";
import { PanelHeading } from "./primitives";

interface Props {
  projectId: string;
  language: string | undefined;
  canEdit: boolean;
  onUseHeadline: (text: string) => void;
  onUseMessages: (texts: string[]) => void;
}

/**
 * Headlines and key messages written from the project's own figures. Every sentence is a fixed pattern filled with a
 * recorded number, so a suggestion cannot say what the records do not. A person picks one; it becomes ordinary text they can edit.
 */
export function SuggestionsPanel({ projectId, language, canEdit, onUseHeadline, onUseMessages }: Props) {
  const [data, setData] = useState<Suggestions | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [rounding, setRounding] = useState<"NONE" | "HUNDREDS" | "THOUSANDS">("NONE");

  const load = async (r: typeof rounding = rounding): Promise<void> => {
    setBusy(true);
    setError(undefined);
    const res = await studio<Suggestions>(`projects/${projectId}/infographic-suggestions?${new URLSearchParams({ ...(language ? { language } : {}), rounding: r })}`);
    setBusy(false);
    if (res.ok) setData(res.data);
    else setError(res.message);
  };

  const [ai, setAi] = useState<AiText | undefined>();
  const [aiBusy, setAiBusy] = useState(false);
  const writeWithAi = async (): Promise<void> => {
    setAiBusy(true);
    setError(undefined);
    const res = await studio<AiText>(`projects/${projectId}/infographic-suggestions/ai`, { method: "POST", body: language ? { language } : {} });
    setAiBusy(false);
    if (res.ok) setAi(res.data);
    else setError(res.message);
  };

  return (
    <div className="space-y-3 text-sm">
      <PanelHeading>Suggested from your records</PanelHeading>
      <p className="text-xs text-slate-500">Sentences built only from figures recorded in this project. Choose one to use it; you can edit it afterwards.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" pending={busy} onClick={() => void load()}>
          {data ? "Refresh" : "Suggest a headline and messages"}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Round to
          <select
            aria-label="Round the figures"
            className="rounded border border-slate-300 bg-white px-1 py-0.5 dark:border-white/10 dark:bg-slate-900"
            value={rounding}
            onChange={(event) => {
              const next = event.target.value as typeof rounding;
              setRounding(next);
              if (data) void load(next);
            }}
          >
            <option value="NONE">Exact</option>
            <option value="HUNDREDS">Hundreds</option>
            <option value="THOUSANDS">Thousands</option>
          </select>
        </label>
      </div>
      {canEdit && (
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-2 dark:border-white/10">
          <p className="text-xs text-slate-500">Optional: have the writing assistant draft wording from the same figures. It is checked against your records; any sentence with a figure you have not recorded is dropped. Review it before you use it.</p>
          <Button size="sm" variant="secondary" pending={aiBusy} onClick={() => void writeWithAi()}>
            {ai ? "Write again" : "Draft wording with AI"}
          </Button>
          {ai && !ai.available && <p className="text-xs text-slate-600 dark:text-slate-300">{ai.reason}</p>}
          {ai && ai.available && (
            <div className="space-y-1.5" aria-label="AI-drafted wording">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">AI-drafted, not yet reviewed{ai.droppedUngrounded > 0 ? ` (${ai.droppedUngrounded} removed for unrecorded figures)` : ""}</p>
              {ai.headlines.map((h) => (
                <div key={h.text} className="flex items-start justify-between gap-2 rounded border border-slate-200 p-2 dark:border-white/10">
                  <span>{h.text}</span>
                  <Button size="sm" variant="secondary" onClick={() => onUseHeadline(h.text)}>Use</Button>
                </div>
              ))}
              {ai.messages.length > 0 && (
                <>
                  <ul className="list-disc space-y-1 pl-5">{ai.messages.map((m) => <li key={m.text}>{m.text}</li>)}</ul>
                  <Button size="sm" variant="secondary" onClick={() => onUseMessages(ai.messages.map((m) => m.text))}>Put these in a key-messages block</Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {data && (
        <>
          <section aria-label="Headlines" className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Headlines</h4>
            {data.headlines.map((h) => (
              <div key={h.text} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <span>{h.text}</span>
                {canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => onUseHeadline(h.text)}>
                    Use
                  </Button>
                )}
              </div>
            ))}
          </section>
          {data.messages.length > 0 && (
            <section aria-label="Key messages" className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key messages</h4>
              <ul className="list-disc space-y-1 pl-5">
                {data.messages.map((m) => (
                  <li key={m.text}>{m.text}</li>
                ))}
              </ul>
              {canEdit && (
                <Button size="sm" variant="secondary" onClick={() => onUseMessages(data.messages.map((m) => m.text))}>
                  Put these in a key-messages block
                </Button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
