"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeRiskAction, raiseRiskAction } from "@/lib/actions/tasks";
import type { RiskItem } from "@/lib/server/schemas";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { ProjectPerson } from "../domain/ask-people";
import { CommentsDisclosure } from "@/features/comments/presentation/CommentsDisclosure";
import { riskKindWords, riskLine, seriousnessWords } from "../domain/risk-view";
import { RISK_KINDS, RISK_KIND_LABEL, RISK_ACTION_HINT, type RiskKind } from "@donordesk/domain/contexts/risks/index.js";

const TONE = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" } as const;

/**
 * "Problems and risks": open ones, the most serious first, with "See all" for the rest. The form has the four things a person
 * knows: what it is (and whether it has happened), how serious, who is handling it, what is being done. No matrix, no categories.
 */
export function RisksCard({ projectId, risks, people, userId, canRaise, today, plannedActivityId }: {
  projectId: string; risks: RiskItem[]; people: ProjectPerson[]; userId: string; canRaise: boolean; today: string; plannedActivityId?: string;
}) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<RiskKind>("PROBLEM");
  const [seriousness, setSeriousness] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [owner, setOwner] = useState("");
  const [action, setAction] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const names = Object.fromEntries(people.map((p) => [p.id, p.label.replace(/ \(you\)$/, "")]));
  const openOnes = risks.filter((r) => r.status === "OPEN");
  const shown = all ? risks : openOnes.slice(0, 3);
  if (risks.length === 0 && !canRaise) return null;

  async function raise(e: React.FormEvent) {
    e.preventDefault();
    const out = await state.runCreate((idempotencyKey) => raiseRiskAction(projectId, { kind, title, seriousness, action, ...(owner ? { ownerId: owner } : {}), ...(plannedActivityId ? { plannedActivityId } : {}) }, { idempotencyKey }));
    if (out) { setOpen(false); setTitle(""); setAction(""); setOwner(""); router.refresh(); }
  }
  async function close(id: string) {
    const done = await state.run(() => closeRiskAction(id, note.trim() ? { note } : {}));
    if (done === true) { setClosing(null); setNote(""); router.refresh(); }
  }
  const err = (k: string) => state.fields?.[k]?.[0];

  return (
    <section className="card" aria-labelledby="risks-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="risks-title" className="font-medium">Problems and risks</h2>
        {canRaise && !open && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Raise a problem</Button>}
      </div>

      {open && (
        <form onSubmit={raise} className="mt-3 max-w-md space-y-3 rounded-xl border border-slate-200 p-3 dark:border-white/10" aria-label="Raise a problem">
          <fieldset disabled={!hydrated || state.busy} className="space-y-3">
            <Field label="What is it?" error={err("title")}><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="What kind is it?"><Select value={kind} onChange={(e) => setKind(e.target.value as RiskKind)}>{RISK_KINDS.map((k) => <option key={k} value={k}>{RISK_KIND_LABEL[k]}</option>)}</Select></Field>
              <Field label="How serious?"><Select value={seriousness} onChange={(e) => setSeriousness(e.target.value as "HIGH" | "MEDIUM" | "LOW")}>{(["HIGH", "MEDIUM", "LOW"] as const).map((s) => <option key={s} value={s}>{seriousnessWords(s)}</option>)}</Select></Field>
            </div>
            <Field label="Who is handling it?" error={err("ownerId")}>
              <Select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Nobody yet</option>{people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
            </Field>
            <Field label={RISK_ACTION_HINT[kind]} error={err("action")}><Textarea dictate rows={2} maxLength={1000} value={action} onChange={(e) => setAction(e.target.value)} /></Field>
          </fieldset>
          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
          <div className="flex gap-2"><Button type="submit" size="sm" pending={state.busy} disabled={!hydrated}>Raise it</Button><Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button></div>
        </form>
      )}

      {risks.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Nothing is open.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
          {shown.map((r) => (
            <li key={r.id} className="py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-slate-500">{riskKindWords(r.kind)} · {riskLine(r, userId, names, today)}</p>
                  {r.status === "OPEN" && r.action && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{r.action}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={r.status === "CLOSED" ? "neutral" : TONE[r.seriousness]}>{r.status === "CLOSED" ? "Closed" : seriousnessWords(r.seriousness)}</Badge>
                  {r.canChange && closing !== r.id && <Button size="sm" variant="ghost" onClick={() => { setClosing(r.id); setNote(""); }}>Close</Button>}
                </div>
              </div>
              <div className="mt-1"><CommentsDisclosure entityType="project_risk" entityId={r.id} /></div>
              {closing === r.id && (
                <div className="mt-2 max-w-md space-y-2">
                  <Field label="How did it end? (optional)"><Textarea dictate rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                  <div className="flex gap-2"><Button size="sm" onClick={() => close(r.id)} pending={state.busy}>Close it</Button><Button size="sm" variant="secondary" onClick={() => setClosing(null)}>Keep it open</Button></div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!all && (openOnes.length > 3 || risks.length > openOnes.length) && <button type="button" className="mt-2 text-sm text-brand-700 underline dark:text-brand-300" onClick={() => setAll(true)}>See all</button>}
      {all && risks.length > 3 && <button type="button" className="mt-2 text-sm text-brand-700 underline dark:text-brand-300" onClick={() => setAll(false)}>Show fewer</button>}
    </section>
  );
}
