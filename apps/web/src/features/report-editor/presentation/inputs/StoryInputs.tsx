"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/Textarea";
import { UnsavedChangesGuard } from "@/components/editor/UnsavedChangesGuard";
import { updateReportingPeriodStoryAction, type StoryContextShape } from "@/lib/actions/reporting";

const SAVE_DELAY_MS = 1000;

const FIELDS: Array<{ key: keyof StoryContextShape; label: string; hint: string; placeholder: string }> = [
  { key: "achievements", label: "What went well?", hint: "Results you are proud of this period.", placeholder: "e.g. Delivered all planned training sessions ahead of schedule." },
  { key: "challenges", label: "What challenges did you face?", hint: "What slowed or blocked the work.", placeholder: "e.g. Flooding delayed access to three communities for about three weeks." },
  {
    key: "varianceExplanations",
    label: "Why were important targets over or under achieved?",
    hint: "The donor will ask about big gaps between target and result.",
    placeholder: "e.g. Fewer beneficiaries than planned due to a late start in District X.",
  },
  { key: "adaptations", label: "What changed or was adapted?", hint: "Changes to plans, locations or methods.", placeholder: "e.g. Switched to mobile delivery to reach remote communities." },
  { key: "lessons", label: "Any important lesson or story? (optional)", hint: "A short example makes the report memorable.", placeholder: "e.g. Early community engagement reduced drop-out substantially." },
];

type SaveState = "idle" | "dirty" | "saving" | "saved" | "failed";

const STATUS_TEXT: Record<SaveState, string> = {
  idle: "",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "All changes saved",
  failed: "Couldn't save",
};

/**
 * "Tell the story" with autosave (Report Editor P5): the context numbers
 * can't explain, which the AI writer uses. Saves a second after typing stops
 * and when a field loses focus; one save at a time, always the latest text.
 */
export function StoryInputs({ periodId, initialStory, canEdit }: { periodId: string; initialStory: StoryContextShape; canEdit: boolean }) {
  const router = useRouter();
  const [story, setStory] = useState<StoryContextShape>(initialStory);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const latestRef = useRef(initialStory);
  const savedRef = useRef(JSON.stringify(initialStory));
  const timerRef = useRef<number | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback(() => {
    window.clearTimeout(timerRef.current);
    queueRef.current = queueRef.current.then(async () => {
      const snapshot = latestRef.current;
      const serialized = JSON.stringify(snapshot);
      if (serialized === savedRef.current) return;
      setState("saving");
      const result = await updateReportingPeriodStoryAction(periodId, snapshot);
      if (!result.ok) {
        setState("failed");
        setError(result.error.message);
        return;
      }
      savedRef.current = serialized;
      setError(null);
      setState(JSON.stringify(latestRef.current) === serialized ? "saved" : "dirty");
      router.refresh();
    });
  }, [periodId, router]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function change(key: keyof StoryContextShape, value: string) {
    const next = { ...latestRef.current, [key]: value };
    latestRef.current = next;
    setStory(next);
    setState("dirty");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(save, SAVE_DELAY_MS);
  }

  return (
    <section aria-labelledby="story-heading" className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="story-heading" className="text-base font-semibold">
            Tell the story
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Context the numbers can’t explain. The AI uses it to write the report.</p>
        </div>
        <p role="status" aria-live="polite" className={`text-xs ${state === "failed" ? "text-danger-700 dark:text-danger-400" : "text-slate-500 dark:text-slate-400"}`}>
          {STATUS_TEXT[state]}
        </p>
      </div>
      {FIELDS.map((field) => (
        <label key={field.key} className="block">
          <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{field.label}</span>
          <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{field.hint}</span>
          <Textarea
            rows={3}
            value={story[field.key] ?? ""}
            placeholder={field.placeholder}
            readOnly={!canEdit}
            onChange={(e) => change(field.key, e.target.value)}
            onBlur={() => {
              if (state === "dirty") save();
            }}
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="text-sm text-danger-700 dark:text-danger-400">
          {error}{" "}
          <button type="button" className="underline" onClick={save}>
            Try again
          </button>
        </p>
      )}
      {!canEdit && <p className="text-sm text-slate-500 dark:text-slate-400">You can read the story; a report writer can change it.</p>}
      <UnsavedChangesGuard dirty={state === "dirty" || state === "saving" || state === "failed"} message="Your story changes are not saved yet. Leave anyway?" />
    </section>
  );
}
