"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportingProfile } from "@/lib/server/schemas";
import { upsertReportingProfileAction } from "@/lib/actions/setup";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const TONES = ["FORMAL", "CONCISE", "NARRATIVE", "TECHNICAL"] as const;

const FINANCE_MODES = [
  { value: "DISABLED", label: "Off", hint: "Reports say financial figures are reported separately. Nothing to enter." },
  { value: "TYPED", label: "Type them in", hint: "Enter budget and expenditure for each quarterly, half-year, annual and final report." },
  { value: "IMPORT", label: "Import a spreadsheet", hint: "Paste budget lines from your finance spreadsheet and confirm them." },
] as const;
type FinanceMode = (typeof FINANCE_MODES)[number]["value"];

export function ReportingProfileForm({
  projectId,
  initialProfile,
}: {
  projectId: string;
  initialProfile: ReportingProfile | null;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState(initialProfile?.language ?? "en");
  const [tone, setTone] = useState(initialProfile?.tone ?? "FORMAL");
  const [writingStyle, setWritingStyle] = useState(initialProfile?.writingStyle ?? "");
  const [audienceNotes, setAudienceNotes] = useState(initialProfile?.audienceNotes ?? "");
  const [formattingRules, setFormattingRules] = useState((initialProfile?.formattingRules ?? []).join("\n"));
  const [specialRequirements, setSpecialRequirements] = useState((initialProfile?.specialRequirements ?? []).join("\n"));
  const [deadlineOffsetDays, setDeadlineOffsetDays] = useState(initialProfile?.deadlineOffsetDays?.toString() ?? "");
  const [autoPeriodCreation, setAutoPeriodCreation] = useState(initialProfile?.autoPeriodCreation ?? false);
  const [financeDataMode, setFinanceDataMode] = useState<FinanceMode>(initialProfile?.financeDataMode ?? "DISABLED");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(useDefaults: boolean) {
    setBusy(true);
    setError(null);
    const body = useDefaults
      ? { language: "en", tone: "FORMAL", formattingRules: [], specialRequirements: [], sectionOverrides: {} }
      : {
          language,
          tone,
          writingStyle: writingStyle || undefined,
          audienceNotes: audienceNotes || undefined,
          formattingRules: formattingRules.split("\n").map((x) => x.trim()).filter(Boolean),
          specialRequirements: specialRequirements.split("\n").map((x) => x.trim()).filter(Boolean),
          sectionOverrides: {},
          deadlineOffsetDays: deadlineOffsetDays ? Number(deadlineOffsetDays) : undefined,
          autoPeriodCreation,
          financeDataMode,
          expectedVersion: initialProfile?.version,
        };
    const result = await upsertReportingProfileAction(projectId, body);
    if (!result.ok) {
      setError(result.error.message ?? "Could not save the reporting profile.");
      setBusy(false);
      return;
    }
    router.push(`/projects/${projectId}/setup`);
    router.refresh();
  }

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="language">Language</label>
          <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="tone">Tone</label>
          <Select id="tone" value={tone} onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}>
            {TONES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </Select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="writingStyle">Writing style (optional)</label>
        <Textarea id="writingStyle" value={writingStyle} onChange={(e) => setWritingStyle(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="audienceNotes">Audience notes (optional)</label>
        <Textarea id="audienceNotes" value={audienceNotes} onChange={(e) => setAudienceNotes(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="formattingRules">Formatting rules (one per line)</label>
        <Textarea id="formattingRules" value={formattingRules} onChange={(e) => setFormattingRules(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="specialRequirements">Special requirements (one per line)</label>
        <Textarea id="specialRequirements" value={specialRequirements} onChange={(e) => setSpecialRequirements(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="deadlineOffsetDays">Deadline offset (days, optional)</label>
          <Input id="deadlineOffsetDays" type="number" min={0} max={365} value={deadlineOffsetDays} onChange={(e) => setDeadlineOffsetDays(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Used to suggest each period&rsquo;s donor deadline when its donor template doesn&rsquo;t state one.
          </p>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPeriodCreation} onChange={(e) => setAutoPeriodCreation(e.target.checked)} />
            Auto-create reporting periods
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            When on, the next monthly, quarterly, annual or final period is created for you (using the project&rsquo;s reporting
            frequency and dates above) the first time you open Reports after it&rsquo;s due. Not available for a semi-annual or
            custom reporting frequency.
          </p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="financeDataMode">Financial figures in reports</label>
        <Select id="financeDataMode" value={financeDataMode} onChange={(e) => setFinanceDataMode(e.target.value as FinanceMode)}>
          {FINANCE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {FINANCE_MODES.find((m) => m.value === financeDataMode)?.hint} Figures are only used in a report once someone with approval
          rights has verified them. Switching this off keeps any figures already entered.
        </p>
      </div>

      {error && <InlineAlert tone="danger" title={error} />}

      <div className="flex gap-3">
        <Button type="submit" pending={busy}>Save profile</Button>
        <Button type="button" variant="secondary" pending={busy} onClick={() => void save(true)}>
          Use defaults
        </Button>
      </div>
    </form>
  );
}
