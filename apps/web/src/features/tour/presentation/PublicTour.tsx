"use client";

import Link from "next/link";
import { useState } from "react";
import { TOUR_STEPS } from "../domain/tour-steps";

/**
 * Public, no-signup walkthrough for the marketing hero. Reuses the Academy
 * step copy (single source of truth) but as a standalone stepper, since the
 * in-app overlay needs an authenticated tenant with a demo project.
 */
export function PublicTour() {
  const [index, setIndex] = useState(0);
  const step = TOUR_STEPS[index]!;
  const last = index === TOUR_STEPS.length - 1;
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">← Back to home</Link>
        <h1 className="mt-6 text-3xl font-bold">DonorDesk product tour</h1>
        <p className="mt-2 text-slate-400">A quick look at the reporting workflow, end to end. No account needed.</p>
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Step {index + 1} of {TOUR_STEPS.length}</p>
          <h2 className="mt-2 text-2xl font-semibold">{step.title}</h2>
          <p className="mt-3 text-slate-300">{step.body}</p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }} />
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-40">Back</button>
            {last ? (
              <Link href="/signup" className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400">Start free</Link>
            ) : (
              <button type="button" onClick={() => setIndex(index + 1)} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400">Next</button>
            )}
          </div>
        </section>
        <p className="mt-6 text-center text-sm text-slate-500">Ready to try it? <Link href="/signup" className="text-emerald-400 hover:underline">Create a free workspace</Link> — it includes a sample project with the full guided tour.</p>
      </div>
    </main>
  );
}
