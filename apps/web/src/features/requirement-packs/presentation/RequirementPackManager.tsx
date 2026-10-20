"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveRequirementPackAction, activateRequirementPackAction } from "@/lib/actions/requirement-packs";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/data/Badge";

export interface PackRow {
  id: string;
  name: string;
  donorKey: string;
  mechanismKey: string;
  reportType: string;
  status: string;
  version: number;
  requirements: Array<{ key: string; kind: string; required: boolean }>;
}

const REPORT_TYPES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"] as const;
const STATUS_TONE = { DRAFT: "neutral", REVIEWED: "info", ACTIVE: "success", RETIRED: "neutral" } as const;

const EXAMPLE = `# One requirement per line: KIND: title. End with ? when it is advisory, not mandatory.
SECTION: Executive summary
SECTION: Results by indicator
ANNEX: Indicator table
QUESTION: Safeguarding statement
SECTION: Lessons learned?`;

/** Lists the organisation's requirement packs and lets an administrator write one as plain lines, then activate it. */
export function RequirementPackManager({ packs }: { packs: PackRow[] }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [name, setName] = useState("");
  const [donor, setDonor] = useState("");
  const [mechanism, setMechanism] = useState("");
  const [reportType, setReportType] = useState<string>("QUARTERLY");
  const [lines, setLines] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const done = await state.run(() => saveRequirementPackAction({ name, donor, mechanism, reportType, lines }));
    if (done) {
      setSaved(true);
      setLines("");
      router.refresh();
    }
  }

  async function activate(id: string) {
    const done = await state.run(() => activateRequirementPackAction(id));
    if (done) router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card" aria-labelledby="packs-title">
        <h2 id="packs-title" className="text-sm font-semibold">Your requirement packs</h2>
        {packs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">None yet. A pack lists what a donor requires of a report; once active, a report that lacks a mandatory item cannot be approved.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
            {packs.map((pack) => (
              <li key={pack.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{pack.name} <span className="text-xs font-normal text-slate-500">version {pack.version}</span></p>
                  <p className="text-xs text-slate-500">{pack.donorKey} · {pack.mechanismKey} · {pack.reportType.replace("_", "-").toLowerCase()} report</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {pack.requirements.length} {pack.requirements.length === 1 ? "requirement" : "requirements"}:{" "}
                    {pack.requirements.map((r) => `${r.key.split(":")[1]?.replace(/-/g, " ") ?? r.key}${r.required ? "" : " (advisory)"}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[pack.status as keyof typeof STATUS_TONE] ?? "neutral"}>{pack.status === "ACTIVE" ? "Active" : pack.status === "DRAFT" ? "Draft" : pack.status === "RETIRED" ? "Retired" : "Reviewed"}</Badge>
                  {pack.status !== "ACTIVE" && pack.status !== "RETIRED" && (
                    <Button variant="secondary" size="sm" disabled={!hydrated || state.busy} onClick={() => void activate(pack.id)}>Activate</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="card space-y-4" onSubmit={(e) => void save(e)} aria-labelledby="new-pack-title">
        <h2 id="new-pack-title" className="text-sm font-semibold">New requirement pack</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pack name" error={state.fields?.name?.[0]}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="USAID quarterly requirements" required /></Field>
          <Field label="Donor" error={state.fields?.donor?.[0]}><Input value={donor} onChange={(e) => setDonor(e.target.value)} placeholder="USAID" required /></Field>
          <Field label="Funding mechanism or template" error={state.fields?.mechanism?.[0]} hint="The same name as the donor template it applies to."><Input value={mechanism} onChange={(e) => setMechanism(e.target.value)} placeholder="Quarterly progress report" required /></Field>
          <Field label="Report type">
            <Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", "-").toLowerCase()}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="What the report must contain" error={state.fields?.lines?.[0]} hint="One per line. Kinds: SECTION, QUESTION, ANNEX, INDICATOR, FIELD, DECLARATION, FINANCIAL, SAFEGUARD, APPROVAL, DEADLINE, FORMAT.">
          <Textarea dictate rows={8} value={lines} onChange={(e) => setLines(e.target.value)} placeholder={EXAMPLE} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!hydrated || state.busy}>Save as draft</Button>
          {saved && <p role="status" className="text-xs text-slate-500">Saved as a draft. Activate it when you have checked it.</p>}
          {state.error && <p role="alert" className="text-xs text-danger-600">{state.error}</p>}
        </div>
      </form>
    </div>
  );
}
