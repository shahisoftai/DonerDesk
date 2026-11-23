"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applyFormKitAction, listFormKitsAction, proposeFormFromFileAction } from "@/lib/actions/assessments";
import { useActionState } from "@/lib/client/action-state";
import type { KitView, ProposalView } from "@/lib/server/schemas-assessments";
import { Button } from "@/components/ui/Button";
import { PROPOSAL_KEY } from "./designer/NewFormDesigner";

/**
 * Two ways to start a form without typing every question: a ready-made form (checked by nobody yet, and said so), or a Word or Excel tool read
 * into a proposal. Neither publishes or saves anything the person has not seen: a kit lands as a draft, a proposal opens in the designer.
 */
export function FormStarters({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [kits, setKits] = useState<KitView[]>([]);
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [applied, setApplied] = useState<{ id: string; notes: string[]; indicators: Array<{ code: string; name: string; plain: string }> } | null>(null);
  const act = useActionState();
  useEffect(() => { void listFormKitsAction().then((r) => { if (r.ok) setKits(r.value); }); }, []);

  async function use(kit: KitView) {
    const r = await act.run(() => applyFormKitAction({ kitId: kit.id, projectId }));
    if (r && typeof r === "object") setApplied({ id: r.id, notes: r.notes, indicators: r.suggestedIndicators });
  }
  async function read(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    const r = await act.run(() => proposeFormFromFileAction(body));
    if (r && typeof r === "object") setProposal(r);
  }
  function openProposal() {
    if (!proposal) return;
    try { sessionStorage.setItem(PROPOSAL_KEY, JSON.stringify(proposal.fields.map((f) => f.field))); } catch { /* the designer then opens empty */ }
    router.push(`/projects/${projectId}/forms/new?from=proposal`);
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h2 className="text-base font-semibold">Start from something that exists</h2>
      {kits.map((k) => (
        <div key={k.id} className="space-y-2">
          <p className="font-medium">{k.name} <span className="text-xs font-normal text-amber-700 dark:text-amber-300">not yet checked by a sector reviewer</span></p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{k.description} {k.fieldCount} items. Source: {k.source}</p>
          <Button variant="secondary" onClick={() => void use(k)} pending={act.busy} disabled={act.busy}>Make a draft from this</Button>
        </div>
      ))}
      {applied && (
        <div role="status" className="space-y-2 rounded-md bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
          <p>The draft is ready. Read it, change what you need, then publish it.</p>
          <ul className="list-disc ps-5">{applied.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          {applied.indicators.length > 0 && <p>Indicators you may want to add to the project, then link in "What the answers add up to": {applied.indicators.map((i) => `${i.code} ${i.name}`).join("; ")}.</p>}
          <Button onClick={() => router.push(`/projects/${projectId}/forms/${applied.id}`)}>Open the draft</Button>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <p className="font-medium">Make a form from your own tool</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">Choose a Word or Excel file. We read its headings, questions and tables and propose a form. Nothing is saved until you open it in the designer and save it.</p>
        <label className="btn-secondary inline-flex cursor-pointer">Choose a file<input type="file" accept=".docx,.doc,.xlsx,.xlsm,.txt,.csv" className="sr-only" onChange={(e) => { void read(e.target.files?.[0]); e.target.value = ""; }} /></label>
        {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
        {proposal && (
          <div role="status" className="space-y-2 text-sm">
            <p>Found {proposal.sections} {proposal.sections === 1 ? "section" : "sections"} and {proposal.fields.filter((f) => f.field.type !== "SECTION" && f.field.type !== "NOTE").length} questions or tables.</p>
            {proposal.problems.length > 0 && <p className="text-amber-700 dark:text-amber-300">Things to fix in the designer: {proposal.problems.slice(0, 3).join(" ")}</p>}
            {proposal.unread.length > 0 && <details><summary className="cursor-pointer">{proposal.unread.length} lines could not be read</summary><ul className="mt-1 max-h-40 list-disc overflow-y-auto ps-5 text-xs">{proposal.unread.slice(0, 60).map((l, i) => <li key={i}>{l}</li>)}</ul></details>}
            <Button onClick={openProposal}>Open in the designer</Button>
          </div>
        )}
      </div>
    </section>
  );
}
