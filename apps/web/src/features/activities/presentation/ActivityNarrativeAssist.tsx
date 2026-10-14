"use client";

import { useState } from "react";
import { proposeActivityFromNarrative } from "@donordesk/domain/contexts/activities/activity-narrative.js";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { PROPOSAL_LABELS, type NarrativeProposal } from "../domain/apply-narrative-proposal";

/**
 * "Tell it in your own words": type or dictate the whole story once, and the fields the words state outright are filled
 * in for the person to check. It never overwrites what is already typed and never guesses.
 */
export function ActivityNarrativeAssist({
  onApply,
}: {
  onApply: (proposal: NarrativeProposal) => { filled: Array<keyof NarrativeProposal>; kept: Array<keyof NarrativeProposal> };
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ filled: string[]; kept: string[] } | null>(null);

  function fill() {
    const proposal = proposeActivityFromNarrative(text, { today: new Date() });
    const { filled, kept } = onApply(proposal);
    setResult({ filled: filled.map((k) => PROPOSAL_LABELS[k]), kept: kept.map((k) => PROPOSAL_LABELS[k]) });
  }

  if (!open) {
    return (
      <p className="text-sm">
        <button type="button" className="text-brand-600 underline dark:text-brand-300" onClick={() => setOpen(true)}>
          Tell it in your own words (type or speak) and fill the form for me
        </button>
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-ai-500/30 bg-ai-500/5 p-4" aria-label="Describe the activity in your own words">
      <h2 className="text-sm font-medium text-slate-800 dark:text-slate-100">Tell it in your own words</h2>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
        Say what happened, when, where and who took part. Start a part with &ldquo;Challenges:&rdquo;, &ldquo;Achievements:&rdquo;,
        &ldquo;Lessons learned:&rdquo; or &ldquo;Next steps:&rdquo; to fill that box. Only what you state is filled in; check it before you submit.
      </p>
      <div className="mt-2">
        <Textarea
          dictate
          aria-label="Describe the activity"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[120px]"
          placeholder="Held a hygiene session in Kisumu on 12 March with 40 women and 12 men…"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" onClick={fill} disabled={!text.trim()}>
          Fill the form
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {result && (
        <div className="mt-3" role="status">
          <InlineAlert tone={result.filled.length > 0 ? "success" : "info"} title={result.filled.length > 0 ? `Filled: ${result.filled.join(", ")}` : "Nothing in that text could be filled in on its own"}>
            {result.kept.length > 0 && <p>Left as you typed it: {result.kept.join(", ")}.</p>}
          </InlineAlert>
        </div>
      )}
    </section>
  );
}
