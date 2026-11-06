"use client";

import type { SetupCopy } from "../copy";
import { lockReason, progressPercent, stepCount, type DeckSlide, type ProposalStatus } from "../domain/slide-deck";
import { useSetupCopy } from "./useSetupCopy";

/** The short name a slide has on the rail, in the person's language. */
export function railLabel(slide: DeckSlide, c: SetupCopy): string {
  switch (slide.kind) {
    case "guide": return c.welcome.short;
    case "upload": return c.upload.short;
    case "reading": return c.reading.short;
    case "area": return c.areas[slide.area!].short;
    case "create": return c.create.short;
    case "done": return c.done.short;
  }
}

/** The steps as a list on wide screens and a progress strip on narrow ones; both show the same locks. */
export function StepRail(props: {
  deck: ReadonlyArray<DeckSlide>;
  current: string;
  status: ProposalStatus | null;
  applied: boolean;
  /** Area slides where at least one item was accepted: only these get a tick, so a tick means a decision was made. */
  decided: ReadonlySet<string>;
  onOpen: (key: string) => void;
}) {
  const { c, n } = useSetupCopy();
  const index = props.deck.findIndex((s) => s.key === props.current);
  const percent = progressPercent(props.deck, props.current);
  const now = props.deck[index];
  return (
    <nav aria-label={c.rail.title}>
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
          <span>{now?.step ? c.nav.stepOf(now.step, stepCount(props.deck)) : now ? railLabel(now, c) : ""}</span>
          <span>{n(percent)}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={c.rail.progress}>
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-400 transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="hidden lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{c.rail.title}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-400 transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
        <ol className="mt-4 space-y-1">
          {props.deck.map((slide, i) => {
            const locked = lockReason(slide, props.status, props.applied);
            const here = slide.key === props.current;
            const past = i < index && locked === null && (slide.kind !== "area" || props.decided.has(slide.key));
            return (
              <li key={slide.key}>
                <button
                  type="button"
                  onClick={() => props.onOpen(slide.key)}
                  disabled={locked !== null}
                  aria-current={here ? "step" : undefined}
                  title={locked ?? undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-sm transition ${here ? "bg-brand-100 font-semibold text-brand-900 dark:bg-brand-400/15 dark:text-brand-100" : locked ? "cursor-not-allowed text-slate-400 dark:text-slate-500" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"}`}
                >
                  <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${here ? "bg-brand-600 text-white" : past ? "bg-accent-500 text-white" : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>
                    {past ? "✓" : slide.step !== null ? n(slide.step) : slide.kind === "done" ? "★" : "•"}
                  </span>
                  <span>{railLabel(slide, c)}</span>
                  <span className="sr-only">{here ? ` (${c.rail.current})` : past ? ` (${c.rail.done})` : locked ? ` (${c.rail.locked})` : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
