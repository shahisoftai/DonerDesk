import { computeIndicatorProgress } from "@/features/logframe/domain/indicator-progress";
import { DISAGGREGATION_DIMENSION_LABEL, INDICATOR_VERIFICATION_LABEL } from "@/lib/labels";

/** Baseline → current → target bar for one indicator, using its latest cumulative value. */
export function IndicatorProgressCard({
  baseline,
  target,
  unit,
  latest,
}: {
  baseline: string;
  target: string;
  unit?: string;
  latest: {
    cumulativeAchievement: string;
    verificationStatus: string;
    disaggregation?: Array<{ dimension: string; category: string; value: string }>;
  } | null;
}) {
  const progress = latest ? computeIndicatorProgress(baseline, target, latest.cumulativeAchievement) : null;
  const suffix = unit ? ` ${unit}` : "";
  const breakdown = new Map<string, string[]>();
  for (const entry of latest?.disaggregation ?? []) {
    breakdown.set(entry.dimension, [...(breakdown.get(entry.dimension) ?? []), `${entry.category} ${entry.value}`]);
  }
  const statusLabel = latest ? (INDICATOR_VERIFICATION_LABEL[latest.verificationStatus] ?? latest.verificationStatus).toLowerCase() : "";

  return (
    <section className="card mt-4" aria-label="Progress toward target">
      <h3 className="font-medium">Progress toward target</h3>
      {!progress ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {latest
            ? "Progress can't be drawn because the baseline, target or latest value is not a number."
            : "No values have been entered yet, so there is no progress to show."}
        </p>
      ) : (
        <>
          <div
            className="relative mt-5 h-3 rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.fraction * 100)}
            aria-label="Share of the distance from baseline to target covered"
          >
            <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${progress.fraction * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>Baseline {progress.baseline}{suffix}</span>
            <span>Target {progress.target}{suffix}</span>
          </div>
          <p className="mt-3 text-sm">
            Latest cumulative value <strong className="tabular-nums">{progress.current}{suffix}</strong>
            {" "}({statusLabel}):{" "}
            {progress.rawFraction > 1
              ? "target exceeded."
              : progress.rawFraction < 0
                ? "moving away from the target."
                : `${Math.round(progress.fraction * 100)}% of the way from baseline to target.`}
          </p>
        </>
      )}
      {breakdown.size > 0 && (
        <div className="mt-4 text-xs">
          <p className="font-medium text-slate-500 dark:text-slate-400">Latest period breakdown</p>
          <dl className="mt-1 grid gap-1">
          {[...breakdown].map(([dimension, parts]) => (
            <div key={dimension} className="flex flex-wrap gap-2">
              <dt className="text-slate-500 dark:text-slate-400">{DISAGGREGATION_DIMENSION_LABEL[dimension] ?? dimension}:</dt>
              <dd className="tabular-nums">{parts.join(" · ")}</dd>
            </div>
          ))}
          </dl>
        </div>
      )}
    </section>
  );
}
