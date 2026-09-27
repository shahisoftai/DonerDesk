import { INDICATOR_VERIFICATION_LABEL } from "@/lib/labels";
import { indicatorVerificationTone, toneClasses, toneFor } from "@/lib/shared/tone";
import { cn } from "@/components/ui/cn";

const FLOW = ["DRAFT", "SUBMITTED", "VERIFIED"] as const;
const EXITS = ["NEEDS_CORRECTION", "REJECTED"] as const;

/** Where this indicator's period updates sit in the Draft → Submitted → Verified review flow. */
export function IndicatorVerificationPipeline({ statuses }: { statuses: readonly string[] }) {
  const counts = new Map<string, number>();
  for (const status of statuses) counts.set(status, (counts.get(status) ?? 0) + 1);

  return (
    <section className="card mt-4" aria-label="Verification pipeline">
      <h3 className="font-medium">Verification pipeline</h3>
      <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {FLOW.map((status, index) => (
          <li key={status} className="flex items-center gap-2">
            <Stage status={status} count={counts.get(status) ?? 0} />
            {index < FLOW.length - 1 && <span aria-hidden className="text-slate-400">→</span>}
          </li>
        ))}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {EXITS.map((status) => (
          <li key={status}><Stage status={status} count={counts.get(status) ?? 0} /></li>
        ))}
      </ul>
    </section>
  );
}

function Stage({ status, count }: { status: string; count: number }) {
  const tone = count > 0 ? indicatorVerificationTone(status) : "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5",
        toneClasses[toneFor(tone)].badge,
        count === 0 && "opacity-60",
      )}
    >
      {INDICATOR_VERIFICATION_LABEL[status] ?? status}
      <span className="font-semibold tabular-nums">{count}</span>
    </span>
  );
}
