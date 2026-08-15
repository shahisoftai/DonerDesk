"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrganizationReportingDefaultsAction } from "@/lib/actions/org";
import { useActionState } from "@/lib/client/action-state";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { OrganizationReportingDefaults } from "@/lib/server/schemas";

const TONES = ["FORMAL", "CONCISE", "NARRATIVE", "TECHNICAL"] as const;
const LANGUAGES = ["en", "ar", "ur", "fr", "ps"] as const;

export function ReportingDefaultsForm({
  initialDefaults,
  defaultLanguage,
}: {
  initialDefaults: OrganizationReportingDefaults;
  defaultLanguage: string;
}) {
  const router = useRouter();
  const [tone, setTone] = useState(initialDefaults.tone ?? "FORMAL");
  const [language, setLanguage] = useState(defaultLanguage);
  const [formattingRules, setFormattingRules] = useState((initialDefaults.formattingRules ?? []).join("\n"));
  const [deadlineOffsetDays, setDeadlineOffsetDays] = useState(initialDefaults.deadlineOffsetDays?.toString() ?? "");
  const [autoPeriodCreation, setAutoPeriodCreation] = useState(initialDefaults.autoPeriodCreation ?? false);
  const { busy, error, run } = useActionState();
  const [saved, setSaved] = useState(false);

  async function save() {
    const result = await run(() =>
      updateOrganizationReportingDefaultsAction({
        reportingDefaults: {
          tone,
          formattingRules: formattingRules.split("\n").map((x) => x.trim()).filter(Boolean),
          deadlineOffsetDays: deadlineOffsetDays ? Number(deadlineOffsetDays) : undefined,
          autoPeriodCreation,
        },
        language,
      }),
    );
    if (result !== undefined) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form
      className="card max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tone">Default tone</label>
          <Select id="tone" value={tone} onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}>
            {TONES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="language">Report language</label>
          <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="formattingRules">Default formatting rules (one per line)</label>
        <Textarea id="formattingRules" value={formattingRules} onChange={(e) => setFormattingRules(e.target.value)} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Examples: "use headings for each section", "attach annex list at the end".
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="deadlineOffsetDays">Deadline offset (days, optional)</label>
          <Input id="deadlineOffsetDays" type="number" min={0} max={365} value={deadlineOffsetDays} onChange={(e) => setDeadlineOffsetDays(e.target.value)} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={autoPeriodCreation} onChange={(e) => setAutoPeriodCreation(e.target.checked)} />
          Auto-create reporting periods for new projects
        </label>
      </div>

      {error && <InlineAlert tone="danger" title={error} />}

      <div className="flex gap-3">
        <Button type="submit" pending={busy}>Save defaults</Button>
        {saved && <span className="self-center text-sm text-success-600 dark:text-success-400">Saved</span>}
      </div>
    </form>
  );
}
