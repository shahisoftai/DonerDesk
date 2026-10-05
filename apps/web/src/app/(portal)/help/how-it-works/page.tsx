import Link from "next/link";
import { WORKFLOW_ORDER, WORKFLOW_RULES } from "@/features/tour/domain/workflow-rules";

export const metadata = { title: "How DonorDesk works" };

/** The order of work and the five rules that surprise people; the wording is shared with the guided tour. */
export default function HowItWorksPage() {
  return (
    <div className="animate-fade-in max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight">How DonorDesk works</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">The order of work, and the rules that are easy to miss.</p>

      <section className="card mt-6" aria-label="Order of work">
        <h2 className="font-medium">The order of work</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {WORKFLOW_ORDER.map((s) => <li key={s.key}>{s.label}</li>)}
        </ol>
      </section>

      <section className="mt-6 space-y-3" aria-label="Rules to know">
        <h2 className="font-medium">Rules to know</h2>
        {WORKFLOW_RULES.map((r) => (
          <article key={r.key} className="card">
            <h3 className="text-sm font-semibold">{r.title}</h3>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{r.body}</p>
          </article>
        ))}
      </section>

      <p className="mt-6 text-sm">
        Prefer a walkthrough? <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href="/projects">Open a project</Link> and start the guided tour from the Help menu.
      </p>
    </div>
  );
}
