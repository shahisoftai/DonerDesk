import type { ReactNode } from "react";
import { Badge } from "@/components/data/Badge";
import { ProgressBar } from "@/components/data/ProgressBar";
import type { Tone } from "@/lib/shared/tone";

/**
 * The shared furniture of the Overview: the frame every section sits in, the small number card, the
 * two bars that read side by side (what was reached beside the clock), and a person's initials.
 *
 * Presentational only: no fetching, no rules.
 */

/** The frame of one section: a small label, the question it answers, and a way further on. */
export function OverviewSection({
  kicker,
  title,
  href,
  linkLabel,
  children,
}: {
  kicker: string;
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">{kicker}</span>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {href && linkLabel ? (
          <a className="ml-auto text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" href={href}>
            {linkLabel} →
          </a>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One number with its label and a line of context. */
export function StatCard({
  label,
  value,
  hint,
  badge,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  badge?: { tone: Tone; text: string };
  children?: ReactNode;
}) {
  return (
    <div className="card min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : null}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {children}
      {hint ? <div className="mt-1 text-[11.5px] leading-4 text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

/**
 * Two bars that read against each other: the clock (how much of the project's time has passed) and
 * what has been reached. The two are never merged into one number — the reading is the reader's.
 */
export function PaceBars({
  clockPercent,
  reachedPercent,
  reachedLabel,
}: {
  clockPercent: number;
  reachedPercent: number | null;
  reachedLabel: string;
}) {
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>Time elapsed {clockPercent}%</span>
        <span>{reachedLabel}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        <div className="h-full rounded-full bg-slate-400/70" style={{ width: `${clockPercent}%` }} />
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        {reachedPercent === null ? (
          <div className="h-full w-0" />
        ) : (
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${reachedPercent}%` }} />
        )}
      </div>
    </div>
  );
}

/** A plain progress bar in a tone. */
export function Bar({ value, tone }: { value: number; tone: Tone }) {
  return <ProgressBar value={value} tone={tone} />;
}

/** A person's initials, so a name can be recognised without a picture. */
export function PersonMark({ name, late }: { name: string; late?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${late ? "bg-amber-700" : "bg-slate-700"}`}
    >
      {initials || "?"}
    </span>
  );
}

/** The line of a card: a title on the left, a state on the right. */
export function CardHead({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        {note ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{note}</p> : null}
      </div>
      {action}
    </div>
  );
}
