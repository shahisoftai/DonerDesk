"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";

const INSTRUCTION_MAX = 500;

/**
 * "Regenerate this section" (Report Editor U11): an optional instruction for
 * the writer and one button. The current text stays until the new text is
 * ready and is kept in the section history.
 */
export function RegeneratePopover({
  sectionTitle,
  isApproved,
  pending,
  onRegenerate,
  onClose,
}: {
  sectionTitle: string;
  isApproved: boolean;
  pending: boolean;
  onRegenerate: (instruction: string) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const id = useId();
  const remaining = INSTRUCTION_MAX - instruction.length;

  return (
    <div className="mb-3 rounded-lg border border-ai-500/30 bg-ai-50/60 p-3 font-sans dark:bg-ai-500/5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800 dark:text-slate-100">
        Regenerate “{sectionTitle}”
      </label>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
        Optional: tell the AI what to change. It writes from the same data and evidence as the rest of the report.
      </p>
      <textarea
        id={id}
        rows={2}
        maxLength={INSTRUCTION_MAX}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        placeholder="For example: Focus more on the flood response"
        className="mt-2 block w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-white/15 dark:bg-slate-900"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {remaining < 100 ? `${remaining} characters left · ` : ""}
          {isApproved ? "The section's approval is removed when the new text arrives. " : ""}
          Your current text stays in the section history.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" pending={pending} onClick={() => onRegenerate(instruction)}>
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
