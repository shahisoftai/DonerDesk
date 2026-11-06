"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface FrameNav {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Why it is disabled, said out loud to the person. */
  reason?: string | null;
}

/** An arrow that points the way the language reads: mirrored for right-to-left. */
const Arrow = ({ forward }: { forward: boolean }) => <span aria-hidden="true" className="inline-block rtl:-scale-x-100">{forward ? "→" : "←"}</span>;

/**
 * One slide: a bold header band, the body and the Back / Next controls. The heading takes focus when the slide opens, so a
 * keyboard or screen-reader user lands at the top of the new step. The band's moving glow is decoration only.
 */
export function SlideFrame(props: {
  slideKey: string;
  eyebrow: string;
  title: string;
  lead: string;
  direction: "forward" | "back";
  back?: FrameNav | undefined;
  next?: FrameNav | undefined;
  nextTone?: "primary" | "quiet";
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [props.slideKey]);
  return (
    <section
      key={props.slideKey}
      aria-roledescription="slide"
      aria-label={`${props.eyebrow}: ${props.title}`}
      className={`setup-slide ${props.direction === "back" ? "setup-slide-back" : ""} overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-lg shadow-brand-900/5 dark:border-white/10 dark:bg-slate-900/60`}
    >
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-100 via-white to-accent-300/30 px-6 py-8 dark:from-brand-900/40 dark:via-slate-900 dark:to-accent-500/15 sm:px-10">
        <div aria-hidden="true" className="setup-orb pointer-events-none absolute -end-10 -top-12 h-52 w-52 rounded-full bg-gradient-to-br from-brand-300/60 to-accent-400/40 blur-3xl" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{props.eyebrow}</p>
        <h1 ref={heading} tabIndex={-1} className="relative mt-2 text-2xl font-semibold tracking-tight text-slate-900 outline-none dark:text-white sm:text-3xl">{props.title}</h1>
        <p className="relative mt-3 max-w-2xl text-base text-slate-700 dark:text-slate-200">{props.lead}</p>
      </header>
      <div className="space-y-6 px-6 py-6 sm:px-10">{props.children}</div>
      {(props.back || props.next) && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 bg-slate-50/70 px-6 py-4 dark:border-white/10 dark:bg-white/5 sm:px-10">
          {props.back ? <button type="button" className="btn-secondary" onClick={props.back.onClick}><Arrow forward={false} /> {props.back.label}</button> : <span />}
          {props.next ? (
            <div className="flex flex-col items-end gap-1">
              <button type="button" className={props.nextTone === "quiet" ? "btn-secondary" : "btn"} onClick={props.next.onClick} disabled={props.next.disabled}>
                {props.next.label} <Arrow forward />
              </button>
              {props.next.disabled && props.next.reason ? <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{props.next.reason}</p> : null}
            </div>
          ) : null}
        </footer>
      )}
    </section>
  );
}
