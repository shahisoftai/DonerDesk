"use client";

import { useState, useTransition } from "react";
import { editDraftAction, getDraftAction } from "@/lib/actions/project-setup-draft";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { NotUsedToggle } from "./NotUsedToggle";
import { usePcwCopy } from "./usePcwCopy";
import { EMPTY_PERSON, FACT_FIELDS, TEAM_ROLES, addPersonOperation, factChanged, factEdit, roleLabel, type FactKey, type PersonForm } from "../domain/team-view";

/**
 * Slide 2: the project's name, code, dates and currency, and the people who will run it. People are named here and invited
 * now or later; nothing exists until Launch. Facts are stored through the proposal's own edit, so a document's reading and a
 * typed value are the same kind of item.
 */
export function ProjectTeamSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const [typed, setTyped] = useState<Record<FactKey, string>>(() => Object.fromEntries(FACT_FIELDS.map((f) => [f.key, view.facts[f.key] ?? ""])) as Record<FactKey, string>);
  const [form, setForm] = useState<PersonForm>(EMPTY_PERSON);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const team = view.extras.team;

  const saveFact = (key: FactKey) => {
    if (!factChanged(view, key, typed[key])) return;
    startTransition(async () => {
      const saved = await editSetupItemAction(id, factEdit(key, typed[key]));
      if (!saved.ok) return setError(saved.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) {
        setError(null);
        // Show what was kept (a currency is stored in capitals), not what was typed.
        setTyped((t) => ({ ...t, [key]: fresh.value.facts[key] ?? "" }));
        onView(fresh.value);
      } else setError(fresh.error.message);
    });
  };

  const run = (operation: unknown) =>
    startTransition(async () => {
      const r = await editDraftAction(id, operation);
      if (r.ok) { setError(null); onView(r.value); } else setError(r.error.message);
    });

  const add = () => {
    const built = addPersonOperation(team, form);
    if (!built.ok) return setError(built.reason);
    run(built.operation);
    setForm(EMPTY_PERSON);
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="pcw-facts" className="grid gap-4 sm:grid-cols-2">
        <h2 id="pcw-facts" className="sr-only">{PCW_COPY.team.details}</h2>
        {FACT_FIELDS.map((f) => (
          <div key={f.key} className={f.kind === "area" ? "sm:col-span-2" : ""}>
            <Field label={PCW_COPY.team.facts[f.key] ?? f.label}>
              {f.kind === "area" ? (
                <Textarea value={typed[f.key]} rows={3} onChange={(e) => setTyped({ ...typed, [f.key]: e.target.value })} onBlur={() => saveFact(f.key)} />
              ) : (
                <Input type={f.kind === "date" ? "date" : "text"} value={typed[f.key]} onChange={(e) => setTyped({ ...typed, [f.key]: e.target.value })} onBlur={() => saveFact(f.key)} />
              )}
            </Field>
          </div>
        ))}
      </section>

      <section aria-labelledby="pcw-team" className="space-y-4">
        <h2 id="pcw-team" className="text-lg font-semibold text-slate-900 dark:text-white">{PCW_COPY.team.title}</h2>
        {team.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{PCW_COPY.team.empty}</p> : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
            {team.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
                  <span className="block text-slate-600 dark:text-slate-300">{PCW_COPY.team.roles[p.role] ?? roleLabel(p.role)}{p.external ? ` · ${PCW_COPY.team.outsidePartner}` : ""} · {p.invite === "NOW" ? PCW_COPY.team.inviteAtLaunch : PCW_COPY.team.inviteLaterWord}{p.email ? ` · ${p.email}` : ""}</span>
                </span>
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => run({ kind: "REMOVE_PERSON", key: p.key })} aria-label={PCW_COPY.team.removeFor(p.name)}>{PCW_COPY.team.remove}</button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-2 dark:border-white/20">
          <Field label={PCW_COPY.team.name}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={PCW_COPY.team.email}><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={PCW_COPY.team.role}>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{TEAM_ROLES.map((r) => <option key={r} value={r}>{PCW_COPY.team.roles[r] ?? roleLabel(r)}</option>)}</Select>
          </Field>
          <Field label={PCW_COPY.team.invitation}>
            <Select value={form.invite} onChange={(e) => setForm({ ...form, invite: e.target.value as "NOW" | "LATER" })}>
              <option value="LATER">{PCW_COPY.common.inviteLater}</option>
              <option value="NOW">{PCW_COPY.common.inviteNow}</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={form.external} onChange={(e) => setForm({ ...form, external: e.target.checked })} /> {PCW_COPY.team.external}</label>
          <div className="sm:col-span-2"><button type="button" className="btn" disabled={pending} onClick={add}>{PCW_COPY.team.add}</button></div>
        </div>
        <NotUsedToggle id={id} view={view} requirement="project.partners" label={PCW_COPY.noPartners} onView={onView} />
        {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
      </section>
    </div>
  );
}
