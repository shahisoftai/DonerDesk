"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  getReportingPeriodStoryAction,
  updateReportingPeriodStoryAction,
  type StoryContextShape,
} from "@/lib/actions/reporting";

const FIELDS: Array<{ key: keyof StoryContextShape; label: string; placeholder: string }> = [
  { key: "achievements", label: "What went well?", placeholder: "e.g. Delivered all planned training sessions ahead of schedule." },
  { key: "challenges", label: "What challenges did you face?", placeholder: "e.g. Flooding delayed access to three communities for about three weeks." },
  { key: "varianceExplanations", label: "Why were important targets over or under achieved?", placeholder: "e.g. Fewer beneficiaries than planned due to a late start in District X." },
  { key: "adaptations", label: "What changed or was adapted?", placeholder: "e.g. Switched to mobile delivery to reach remote communities." },
  { key: "lessons", label: "Any important lesson or story? (optional)", placeholder: "e.g. Early community engagement reduced drop-out substantially." },
];

/**
 * Increment 2 — "Tell the Story". Structured narrative inputs that indicators
 * and evidence alone cannot explain. Each field maps to a structured story
 * context key on the reporting period, which the AI report writer consumes
 * when generating the report. Simple to edit; heavy machinery stays behind it.
 */
export function StoryPanel({ periodId }: { periodId: string }) {
  const [story, setStory] = useState<StoryContextShape>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getReportingPeriodStoryAction(periodId).then((result) => {
      if (!active) return;
      if (result.ok && result.value.storyContext) setStory(result.value.storyContext);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [periodId]);

  const setField = useCallback((key: keyof StoryContextShape, value: string) => {
    setStory((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    const result = await updateReportingPeriodStoryAction(periodId, story);
    setSaving(false);
    setStatus(result.ok ? "Saved." : result.error.message);
  }, [periodId, story]);

  return (
    <section className="card space-y-3">
      <div>
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Tell the Story</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Context the numbers can't explain. This helps the AI write a professional report.
        </p>
      </div>
      {!loaded ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</span>
              <Textarea
                rows={2}
                value={story[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => setField(field.key, e.target.value)}
              />
            </label>
          ))}
          <div className="flex items-center justify-between">
            <Button size="sm" variant="secondary" onClick={save} disabled={saving} pending={saving}>
              {saving ? "Saving…" : "Save story"}
            </Button>
            {status && <span className="text-xs text-slate-500 dark:text-slate-400">{status}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
