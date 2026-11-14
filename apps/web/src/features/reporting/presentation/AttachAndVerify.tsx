"use client";

import { useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Drawer } from "@/components/feedback/Drawer";
import { uploadEvidenceAction, verifyEvidenceAction } from "@/lib/actions/evidence";
import { verifyAllIndicatorUpdatesAction } from "@/lib/actions/indicators";

export interface NeedsFile { updateId: string; indicatorId: string; code: string; name: string }
type RowState = { phase: "idle" | "working" | "done" | "error"; note?: string };

/**
 * Attach-then-verify (Version 4.000, plan F17): for each value that cannot be verified without a file, pick the file here; it is
 * uploaded to this period and indicator (the same upload as the Evidence page), verified when you may verify files, and then the
 * value is verified again through the same rule as "Verify all". Nothing is verified that the rules would refuse.
 */
export function AttachAndVerify({ open, onClose, projectId, periodId, items, onChanged }: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  periodId: string;
  items: readonly NeedsFile[];
  onChanged: () => void;
}) {
  const [state, setState] = useState<Record<string, RowState>>({});
  const set = (id: string, s: RowState) => setState((cur) => ({ ...cur, [id]: s }));

  async function attach(item: NeedsFile, file: File) {
    set(item.updateId, { phase: "working", note: "Uploading…" });
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("title", `Evidence for ${item.code}`);
    form.set("evidenceType", "OTHER");
    form.set("reportingPeriodId", periodId);
    form.set("indicatorId", item.indicatorId);
    form.set("file", file);
    const up = await uploadEvidenceAction(form);
    if (!up.ok) return set(item.updateId, { phase: "error", note: up.error.message });
    set(item.updateId, { phase: "working", note: "Verifying the file…" });
    const fileCheck = await verifyEvidenceAction(up.value.id);
    if (!fileCheck.ok) {
      onChanged();
      return set(item.updateId, { phase: "error", note: `The file is attached. ${fileCheck.error.message} Someone who reviews files must verify it, then verify the value again.` });
    }
    set(item.updateId, { phase: "working", note: "Verifying the value…" });
    const value = await verifyAllIndicatorUpdatesAction(periodId, [item.updateId]);
    onChanged();
    if (!value.ok) return set(item.updateId, { phase: "error", note: value.error.message });
    const failed = value.value.failed[0];
    set(item.updateId, failed ? { phase: "error", note: failed.message } : { phase: "done", note: "File attached and value verified." });
  }

  return (
    <Drawer open={open} onClose={onClose} title="Attach the files these values need" description="Each value below needs a file that proves it before it can be verified." size="md">
      <ul className="space-y-3">
        {items.map((item) => {
          const s = state[item.updateId] ?? { phase: "idle" };
          return (
            <li key={item.updateId} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p className="text-sm font-medium"><span className="font-mono text-xs text-slate-500">{item.code}</span> {item.name}</p>
              {s.phase === "done" ? (
                <p role="status" className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 aria-hidden="true" className="h-4 w-4" />{s.note}</p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className={`btn-secondary btn-sm cursor-pointer ${s.phase === "working" ? "pointer-events-none opacity-50" : ""}`}>
                    <Upload aria-hidden="true" />Choose a file
                    <input type="file" className="sr-only" disabled={s.phase === "working"} onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach(item, f); e.target.value = ""; }} />
                  </label>
                  {s.note && <span role={s.phase === "error" ? "alert" : "status"} className={`text-xs ${s.phase === "error" ? "text-danger-700 dark:text-danger-400" : "text-slate-500"}`}>{s.note}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Drawer>
  );
}
