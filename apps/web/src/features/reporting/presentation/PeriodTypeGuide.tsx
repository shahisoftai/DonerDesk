import { Badge } from "@/components/data/Badge";
import { HelpButton } from "@/features/tour/presentation/HelpButton";

export type PeriodTypeOptionView = {
  type: string;
  label: string;
  what: string;
  available: boolean;
  why?: string;
  nextAction?: string;
  financeAvailable: boolean;
  suggestedDates?: { startDate: string; endDate: string };
};

/** "What you can create": every report type with what it is for and, when it cannot be created, why and what to do. */
export function PeriodTypeGuide({ options, selected, projectId }: { options: PeriodTypeOptionView[]; selected: string; projectId?: string }) {
  return (
    <section className="card max-w-2xl" aria-label="What you can create">
      <div className="flex items-center justify-between gap-2"><h2 className="font-medium">What you can create</h2><HelpButton topic="how-it-works" /></div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Regular reports (monthly, quarterly, semi-annual, annual) follow one another without overlap, and a final report closes them. Activity, situation and custom reports are one-offs.
      </p>
      <ul className="mt-3 space-y-2">
        {options.map((o) => (
          <li key={o.type} className={`rounded-md border p-2 text-sm ${o.type === selected ? "border-brand-500/50" : "border-slate-200 dark:border-white/10"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{o.label}</span>
              <Badge tone={o.available ? "success" : "warning"}>{o.available ? "Available" : "Not available"}</Badge>
              {o.financeAvailable && <Badge tone="neutral">Finance</Badge>}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{o.what}</p>
            {o.type === "FINAL" && projectId && (
              <a className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/reports/closing`}>Use the guided closing report</a>
            )}
            {!o.available && (
              <p className="mt-1 text-xs text-warning-800 dark:text-warning-300">
                {o.why} {o.nextAction}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
