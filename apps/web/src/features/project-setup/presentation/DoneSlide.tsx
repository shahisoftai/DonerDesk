"use client";

import Link from "next/link";
import type { SetupApplyResult } from "@/lib/server/schemas-project-setup";
import { useSetupCopy } from "./useSetupCopy";

const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 7) * 0.12}s`,
  dx: `${((i * 53) % 120) - 60}px`,
  color: ["bg-brand-400", "bg-accent-400", "bg-coral", "bg-skyline"][i % 4]!,
}));

/** Where each "next step" link goes, in order; the first and the last open the project itself. */
const NEXT_PATHS: ReadonlyArray<string | null> = [null, "logframe", "finance", "team", null];

/** The finish: a celebration, what was created, where the documents are, and the next things to do with links straight to them. */
export function DoneSlide({ projectId, result }: { projectId: string | null | undefined; result: SetupApplyResult | null }) {
  const { c, n } = useSetupCopy();
  const d = c.done;
  const base = projectId ? `/projects/${encodeURIComponent(projectId)}` : null;
  const documents = result?.documents ?? [];
  const failedMove = documents.some((x) => x.error);
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none relative -mt-2 h-0">
        {CONFETTI.map((piece, i) => <span key={i} className={`setup-confetti absolute top-0 h-2.5 w-2 rounded-sm ${piece.color}`} style={{ left: piece.left, animationDelay: piece.delay, ["--dx" as string]: piece.dx }} />)}
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <span aria-hidden="true" className="setup-pop grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-accent-400 text-3xl text-white shadow-lg">★</span>
        <p role="status" className="text-lg font-semibold text-slate-900 dark:text-white">{result?.status === "PARTIAL" ? d.partial : d.createdDraft}</p>
      </div>
      {result && (
        <ul aria-label={d.createdDraft} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {result.areas.map((a) => (
            <li key={a.area} className={`rounded-xl border p-3 text-sm ${a.status === "FAILED" ? "border-red-300 bg-red-50 dark:bg-red-400/10" : "border-green-400/40 bg-green-50 dark:bg-green-400/5"}`}>
              <p className="font-medium text-slate-900 dark:text-slate-100">{c.areas[a.area].short}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{a.status === "FAILED" ? d.areaCouldNot : a.created > 0 ? d.areaCreated(n(a.created)) : a.skipped > 0 ? d.areaThere : d.areaDone}</p>
            </li>
          ))}
        </ul>
      )}
      {documents.length > 0 && (
        <section aria-label={d.documentsIn} className={`rounded-xl border p-4 text-sm ${failedMove ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100" : "border-green-400/40 bg-green-50 text-slate-800 dark:bg-green-400/5 dark:text-slate-100"}`}>
          <p role="status" className="font-semibold">{d.documentIn}</p>
          <ul className="mt-2 space-y-1">
            {documents.map((doc, i) => (
              <li key={`${doc.name}-${i}`}>
                <span className="font-medium">{doc.name}</span>{" "}
                {doc.error ?? d.documentMoved(doc.folder ?? "")}{" "}
                {doc.link && !doc.error ? <a href={doc.link} target="_blank" rel="noopener noreferrer" className="font-medium underline">{d.documentOpen}</a> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
      {base && (
        <ol className="space-y-3">
          {d.next.map((step, i) => {
            const path = NEXT_PATHS[i] ?? null;
            const href = path ? `${base}/${path}` : base;
            return (
              <li key={step.title} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-900/50">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 dark:bg-brand-400/15 dark:text-brand-200">{n(i + 1)}</span>
                  <div><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{step.title}</p><p className="text-xs text-slate-600 dark:text-slate-300">{step.text}</p></div>
                </div>
                <Link href={href} className={i === 0 ? "btn shrink-0" : "btn-secondary shrink-0"}>{step.cta}</Link>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex justify-center"><Link href="/projects/new/document" className="text-sm text-brand-700 underline dark:text-brand-300">{d.another}</Link></div>
    </>
  );
}
