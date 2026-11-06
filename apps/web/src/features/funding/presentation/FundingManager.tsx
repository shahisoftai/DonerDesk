"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProgrammeAction, saveGrantAction, placeProjectAction } from "@/lib/actions/funding";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import type { FundingResponse } from "@/lib/server/schemas";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const money = (totals: Record<string, number>): string => {
  const parts = Object.entries(totals).map(([currency, amount]) => `${amount.toLocaleString("en")} ${currency}`);
  return parts.length > 0 ? parts.join(" + ") : "none recorded";
};

/** Programmes, the grants under them, and which project sits where. Administrators can add and place; everyone else reads. */
export function FundingManager({ funding, canManage }: { funding: FundingResponse; canManage: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [programmeName, setProgrammeName] = useState("");
  const [grant, setGrant] = useState({ title: "", donorName: "", programmeId: "", amount: "", currency: "USD" });

  const placements = [
    ...funding.programmes.flatMap((p) => p.projects.map((project) => ({ project, where: p.name }))),
    ...funding.looseGrants.flatMap((g) => g.projects.map((project) => ({ project, where: g.title }))),
  ];
  const allProjects = [...placements.map((p) => p.project), ...funding.unplacedProjects];
  const grants = [...funding.programmes.flatMap((p) => p.grants), ...funding.looseGrants];

  async function run(action: () => Promise<{ ok: boolean }>) {
    const done = await state.run(action as never);
    if (done) router.refresh();
  }

  return (
    <div className="space-y-6">
      {funding.programmes.length === 0 && funding.looseGrants.length === 0 && (
        <p className="card text-sm text-slate-600 dark:text-slate-300">No programmes or grants yet. Add a programme to group related awards and projects, or add a grant on its own.</p>
      )}

      {funding.programmes.map((p) => (
        <section key={p.id} className="card" aria-labelledby={`prog-${p.id}`}>
          <h2 id={`prog-${p.id}`} className="text-base font-semibold">{p.name}{p.code ? <span className="ml-2 text-xs font-normal text-slate-500">{p.code}</span> : null}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {p.totals.projectCount} {p.totals.projectCount === 1 ? "project" : "projects"} ({p.totals.activeProjectCount} active) · project budgets {money(p.totals.budgetByCurrency)} · awarded {money(p.totals.awardedByCurrency)}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {p.grants.map((g) => <li key={g.id}><strong>{g.title}</strong> · {g.donorName}{g.amount ? ` · ${Number(g.amount).toLocaleString("en")} ${g.currency}` : ""}</li>)}
            {p.projects.map((project) => <li key={project.id} className="text-slate-600 dark:text-slate-300">Project: {project.title}</li>)}
          </ul>
        </section>
      ))}

      {funding.looseGrants.length > 0 && (
        <section className="card" aria-labelledby="loose-grants">
          <h2 id="loose-grants" className="text-base font-semibold">Grants outside a programme</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {funding.looseGrants.map((g) => <li key={g.id}><strong>{g.title}</strong> · {g.donorName}{g.amount ? ` · ${Number(g.amount).toLocaleString("en")} ${g.currency}` : ""} · {g.projects.length} {g.projects.length === 1 ? "project" : "projects"}</li>)}
          </ul>
        </section>
      )}

      {funding.unplacedProjects.length > 0 && (
        <section className="card" aria-labelledby="unplaced">
          <h2 id="unplaced" className="text-base font-semibold">Projects not under a grant or programme</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {funding.unplacedProjects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-3">
                <span>{project.title}</span>
                {canManage && grants.length > 0 && (
                  <Select aria-label={`Place ${project.title} under a grant`} defaultValue="" disabled={!hydrated || state.busy} onChange={(e) => e.target.value && void run(() => placeProjectAction(project.id, { grantId: e.target.value }))}>
                    <option value="">Place under a grant…</option>
                    {grants.map((g) => <option key={g.id} value={g.id}>{g.title} ({g.donorName})</option>)}
                  </Select>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => saveProgrammeAction({ name: programmeName })).then(() => setProgrammeName("")); }}>
            <h2 className="text-sm font-semibold">New programme</h2>
            <Field label="Programme name" error={state.fields?.name?.[0]}><Input value={programmeName} onChange={(e) => setProgrammeName(e.target.value)} placeholder="Horn of Africa resilience" required /></Field>
            <Button type="submit" disabled={!hydrated || state.busy}>Add programme</Button>
          </form>
          <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => saveGrantAction({ title: grant.title, donorName: grant.donorName, ...(grant.programmeId ? { programmeId: grant.programmeId } : {}), ...(grant.amount ? { amount: grant.amount, currency: grant.currency } : {}) })).then(() => setGrant({ ...grant, title: "", amount: "" })); }}>
            <h2 className="text-sm font-semibold">New grant</h2>
            <Field label="Grant title" error={state.fields?.title?.[0]}><Input value={grant.title} onChange={(e) => setGrant({ ...grant, title: e.target.value })} placeholder="WASH 2026–2028" required /></Field>
            <Field label="Donor" error={state.fields?.donorName?.[0]}><Input value={grant.donorName} onChange={(e) => setGrant({ ...grant, donorName: e.target.value })} placeholder="USAID" required /></Field>
            <Field label="Programme (optional)">
              <Select value={grant.programmeId} onChange={(e) => setGrant({ ...grant, programmeId: e.target.value })}>
                <option value="">None</option>
                {funding.programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (optional)"><Input value={grant.amount} onChange={(e) => setGrant({ ...grant, amount: e.target.value })} inputMode="decimal" placeholder="250000" /></Field>
              <Field label="Currency"><Input value={grant.currency} onChange={(e) => setGrant({ ...grant, currency: e.target.value })} maxLength={3} /></Field>
            </div>
            <Button type="submit" disabled={!hydrated || state.busy}>Add grant</Button>
          </form>
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      <p className="text-xs text-slate-500">{allProjects.length} {allProjects.length === 1 ? "project" : "projects"} visible to you.</p>
    </div>
  );
}
