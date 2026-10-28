"use client";

import { useState } from "react";
import { askProjectAction } from "@/lib/actions/ask";
import { useActionState } from "@/lib/client/action-state";
import type { AskOutcomeView } from "@/lib/server/schemas-ask";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";

const KIND_LABEL = { PROJECT: "Project", INDICATOR: "Indicator values", ACTIVITY: "Activity record", EVIDENCE: "Evidence file" } as const;

const EXAMPLES = ["How many households received kits so far?", "Which indicators are behind their target?", "What did the hygiene sessions in Gulu cover?"];

/** Ask a question about this project. The answer is made only from the project's records and each sentence shows where it comes from. */
export function AskPanel({ projectId }: { projectId: string }) {
  const act = useActionState();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [outcome, setOutcome] = useState<AskOutcomeView | null>(null);

  async function ask(q = question) {
    setOutcome(null);
    setAsked(q);
    const r = await act.run(() => askProjectAction(projectId, { question: q }));
    if (r && typeof r === "object") setOutcome(r);
  }

  return (
    <div className="space-y-5">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <Field label="Your question" description="Answers use only this project's records that you are allowed to see. Nothing is guessed: if the records do not say, you are told so.">
          <Textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" pending={act.busy} disabled={act.busy || question.trim().length < 3}>Ask</Button>
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:border-brand-400 dark:border-white/15" onClick={() => { setQuestion(example); void ask(example); }} disabled={act.busy}>{example}</button>
          ))}
        </div>
      </form>

      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {act.busy && <p role="status" className="text-sm text-slate-500">Reading the records…</p>}

      {outcome && !outcome.available && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">{outcome.reason}</p>}

      {outcome && outcome.available && (
        <section className="space-y-4" aria-label="Answer">
          <p className="text-xs text-slate-500">You asked: {asked}</p>
          {outcome.status === "ANSWERED" ? (
            <ol className="space-y-3">
              {outcome.sentences.map((s, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  {s.text}
                  <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                    {s.sources.map((src) => (
                      <span key={src.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200" title={`${KIND_LABEL[src.kind]}${src.status ? ` · ${src.status}` : ""}`}>
                        {src.label}{src.status ? ` · ${src.status}` : ""}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm">{outcome.missing[0] ?? "The project's records do not answer this question."}</p>
          )}
          {outcome.status === "ANSWERED" && outcome.missing.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="font-medium">What the records do not tell</p>
              <ul className="mt-1 list-disc pl-5">{outcome.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Looked at {outcome.looked.indicators} indicator{outcome.looked.indicators === 1 ? "" : "s"}, {outcome.looked.activities} accepted activit{outcome.looked.activities === 1 ? "y" : "ies"} and {outcome.looked.evidence} piece{outcome.looked.evidence === 1 ? "" : "s"} of evidence text.
            {outcome.dropped.uncited + outcome.dropped.ungrounded > 0 && ` ${outcome.dropped.uncited + outcome.dropped.ungrounded} sentence${outcome.dropped.uncited + outcome.dropped.ungrounded === 1 ? " was" : "s were"} left out because it named no source or quoted a figure the source does not contain.`}
            {" "}Values marked &ldquo;not yet verified&rdquo; are drafts. Check the source before you rely on an answer.
          </p>
        </section>
      )}
    </div>
  );
}
