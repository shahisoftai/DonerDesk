"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "@/lib/client/action-state";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { COMMON_CURRENCIES, amountProblem } from "../domain/finance-view";
import { FINANCE_COPY as C } from "../domain/finance-copy";

export interface EntryField {
  name: string;
  label: string;
  kind: "text" | "amount" | "date" | "select" | "currency";
  options?: ReadonlyArray<{ value: string; label: string }>;
  required?: boolean;
  initial?: string;
  hint?: string;
}

/**
 * One small form for every "add something" on the finance screens: the fields are data, the action is passed in, and a success refreshes the page.
 * An amount is checked as the server will before it is sent; the server's own answer (a permission, a rule) is shown under the form.
 */
export function EntryForm({ title, fields, submit, onSubmit }: {
  title: string;
  fields: ReadonlyArray<EntryField>;
  submit: string;
  onSubmit: (values: Record<string, string>) => Promise<Result<unknown, AppError>>;
}) {
  const router = useRouter();
  const act = useActionState();
  const blank = () => Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(blank);
  const [saved, setSaved] = useState(false);
  const missing = fields.some((f) => f.required && (values[f.name] ?? "").trim() === "");
  const amountError = fields.filter((f) => f.kind === "amount").map((f) => amountProblem(values[f.name] ?? "")).find(Boolean) ?? null;

  async function go(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const sent = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== "")) as Record<string, string>;
    const out = await act.run(() => onSubmit(sent));
    if (out) { setValues(blank()); setSaved(true); router.refresh(); }
  }

  return (
    <form onSubmit={go} className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10" aria-label={title}>
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} {...(f.hint ? { description: f.hint } : {})} {...(act.fields?.[f.name]?.[0] ? { error: act.fields[f.name]![0] } : f.kind === "amount" && amountProblem(values[f.name] ?? "") ? { error: amountProblem(values[f.name] ?? "")! } : {})}>
            {f.kind === "select" ? (
              <Select value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} disabled={act.busy}>
                <option value="">{C.choose}</option>
                {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            ) : (
              <Input type={f.kind === "date" ? "date" : "text"} inputMode={f.kind === "amount" ? "decimal" : undefined} {...(f.kind === "currency" ? { maxLength: 3, list: "finance-currencies" } : {})} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: f.kind === "currency" ? e.target.value.toUpperCase() : e.target.value }))} disabled={act.busy} />
            )}
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={act.busy || missing || amountError !== null}>{act.busy ? C.saving : submit}</Button>
        {saved && !act.error && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{C.saved}</span>}
        {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      </div>
    <datalist id="finance-currencies">{COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
    </form>
  );
}
