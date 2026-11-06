import type { AutomationHistory } from "@/lib/server/schemas";

/** What the automations sent for this project, newest first: the day, the rule in plain words, the activity, and who was told. */
export function AutomationHistoryCard({ data, names }: { data: AutomationHistory; names: Record<string, string> }) {
  return (
    <section aria-labelledby="automation-history-title" className="space-y-2">
      <h3 id="automation-history-title" className="text-base font-semibold">What was sent</h3>
      {data.items.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">Nothing has been sent yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 text-sm dark:divide-white/10">
          {data.items.map((row, i) => (
            <li key={`${row.sentOn}-${row.recipientId}-${i}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
              <span><span className="font-mono text-slate-500">{row.sentOn}</span> {row.activity}</span>
              <span className="text-slate-600 dark:text-slate-300">{row.rule} · to {names[row.recipientId] ?? "a team member"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
