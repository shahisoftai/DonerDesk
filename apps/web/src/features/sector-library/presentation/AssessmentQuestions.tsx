"use client";

import { useEffect, useState } from "react";
import type { AssessmentQuestion } from "@donordesk/domain";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { sectorPackAction } from "@/lib/actions/sector-library";

/**
 * The starting assessment the chosen sectors usually need answered (Phase 46.4). Optional: an unanswered question is skipped, not
 * a blocker. Answers are saved one at a time when the field is left, and travel with the project when it is started.
 */
export function AssessmentQuestions({ sectors, answers, onSave }: { sectors: readonly string[]; answers: Record<string, string>; onSave: (key: string, value: string) => void }) {
  const { t } = useI18n();
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>(answers);
  useEffect(() => { setDraft(answers); }, [answers]);
  useEffect(() => {
    let alive = true;
    void Promise.all(sectors.map((s) => sectorPackAction(s))).then((rs) => {
      if (!alive) return;
      const seen = new Set<string>();
      const all: AssessmentQuestion[] = [];
      for (const r of rs) {
        if (!r.ok) continue;
        const part = r.value.parts.find((p) => p.key === "assessment");
        for (const q of (part?.items ?? []) as AssessmentQuestion[]) if (!seen.has(q.key)) { seen.add(q.key); all.push(q); }
      }
      setQuestions(all);
    });
    return () => { alive = false; };
  }, [sectors.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (sectors.length === 0 || questions.length === 0) return null;
  return (
    <section aria-label={t("lib.start.assessment")} className="space-y-2" data-testid="library-assessment">
      <h3 className="text-sm font-semibold">{t("lib.start.assessment")}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t("lib.start.assessmentHelp")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {questions.map((q) => (
          <label key={q.key} className="block text-sm">
            <span className="mb-1 block">{q.question}</span>
            {q.answerType === "CHOICE" && q.choices ? (
              <select className="input w-full" value={draft[q.key] ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, [q.key]: e.target.value })); onSave(q.key, e.target.value); }}>
                <option value="">—</option>{q.choices.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : q.answerType === "YES_NO" ? (
              <select className="input w-full" value={draft[q.key] ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, [q.key]: e.target.value })); onSave(q.key, e.target.value); }}>
                <option value="">—</option><option value="Yes">Yes</option><option value="No">No</option>
              </select>
            ) : (
              <input className="input w-full" type={q.answerType === "NUMBER" ? "number" : "text"} value={draft[q.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [q.key]: e.target.value }))} onBlur={() => (draft[q.key] ?? "") !== (answers[q.key] ?? "") && onSave(q.key, draft[q.key] ?? "")} />
            )}
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{q.why}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
