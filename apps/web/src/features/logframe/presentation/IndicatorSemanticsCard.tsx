"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateIndicatorSemanticsAction } from "@/lib/actions/logframe";
import { SemanticsBadge, type SemanticsSummary } from "./SemanticsBadge";
import { ConfirmSemanticsButton } from "./ConfirmSemanticsButton";
import { semanticsIntro } from "@/features/logframe/domain/semantics-copy";

type Semantics = {
  aggregation: string;
  direction: string;
  reportingBasis: string;
  numeratorIndicatorId?: string;
  denominatorIndicatorId?: string;
  status: string;
};

const AGGREGATIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "LATEST", label: "Reported directly (latest value)", hint: "Use for rates and scores measured by a survey or assessment and entered as-is (e.g. 87%)." },
  { value: "SUM", label: "Sum of period values", hint: "Use for counts that add up across periods (e.g. children enrolled)." },
  { value: "AVERAGE", label: "Average of values", hint: "Use for scores averaged across sites or periods." },
  { value: "PERCENTAGE", label: "Percentage: numerator ÷ denominator", hint: "Calculated from two other indicators in this project." },
  { value: "RATIO", label: "Ratio: numerator ÷ denominator", hint: "Calculated from two other indicators in this project." },
  { value: "MIN", label: "Lowest value", hint: "" },
  { value: "MAX", label: "Highest value", hint: "" },
];

const DIRECTIONS = [
  { value: "HIGHER_IS_BETTER", label: "Higher is better" },
  { value: "LOWER_IS_BETTER", label: "Lower is better" },
  { value: "NEUTRAL", label: "Neutral (descriptive only)" },
];

/**
 * Lets a project owner declare how an indicator's value is calculated. Until
 * this is set for percentage/ratio indicators the report marks them "Not
 * calculable" and the grid warns that no denominator is configured.
 */
export function IndicatorSemanticsCard({
  indicatorId,
  current,
  description,
  candidates,
}: {
  indicatorId: string;
  current: Semantics | null;
  /** What the report currently does with this indicator (server-computed from the effective semantics). */
  description?: (SemanticsSummary & { reasons: string[] }) | null;
  candidates: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [aggregation, setAggregation] = useState(current?.aggregation ?? "LATEST");
  const [direction, setDirection] = useState(current?.direction ?? "NEUTRAL");
  const [basis, setBasis] = useState(current?.reportingBasis ?? "PERIOD");
  const [numerator, setNumerator] = useState(current?.numeratorIndicatorId ?? "");
  const [denominator, setDenominator] = useState(current?.denominatorIndicatorId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const needsPair = aggregation === "PERCENTAGE" || aggregation === "RATIO";
  const hint = AGGREGATIONS.find((a) => a.value === aggregation)?.hint;

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await updateIndicatorSemanticsAction({
      indicatorId,
      aggregation,
      direction,
      reportingBasis: basis,
      numeratorIndicatorId: needsPair && numerator ? numerator : undefined,
      denominatorIndicatorId: needsPair && denominator ? denominator : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error.message });
      return;
    }
    setMessage({ tone: "ok", text: "Saved. New drafts will use this calculation." });
    router.refresh();
  }

  const fieldClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900";

  return (
    <section className="card mt-4" aria-labelledby="semantics-heading">
      <h3 id="semantics-heading" className="font-medium">How this value is calculated</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {semanticsIntro({ configured: current?.status === "CONFIGURED", needsReview: description?.needsReview })}
      </p>
      {description && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
          <SemanticsBadge description={description} />
          <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{description.summary}</span>
          {description.needsReview && <ConfirmSemanticsButton indicatorIds={[indicatorId]} label="Confirm as suggested" />}
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Calculation</span>
          <select className={fieldClass} value={aggregation} onChange={(e) => setAggregation(e.target.value)}>
            {AGGREGATIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
        </label>
        <label className="text-sm">
          <span className="font-medium">Direction of progress</span>
          <select className={fieldClass} value={direction} onChange={(e) => setDirection(e.target.value)}>
            {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Reporting basis</span>
          <select className={fieldClass} value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="PERIOD">This period’s value</option>
            <option value="CUMULATIVE">Cumulative to date</option>
          </select>
        </label>
        {needsPair && (
          <>
            <label className="text-sm">
              <span className="font-medium">Numerator indicator</span>
              <select className={fieldClass} value={numerator} onChange={(e) => setNumerator(e.target.value)}>
                <option value="">Select…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Denominator indicator</span>
              <select className={fieldClass} value={denominator} onChange={(e) => setDenominator(e.target.value)}>
                <option value="">Select…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          </>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn" onClick={() => void save()} disabled={busy || (needsPair && (!numerator || !denominator))}>
          {busy ? "Saving…" : "Save calculation"}
        </button>
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-danger-700 dark:text-danger-400" : "text-success-700 dark:text-success-400"}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
