import Link from "next/link";
import type { EvidenceSupport } from "@/lib/server/schemas";
import { Badge } from "@/components/data/Badge";
import { EVIDENCE_VERIFICATION_LABEL } from "@/lib/labels";

/**
 * Which files back this activity or indicator, and which report statements rely on each.
 * "Used in reports" = attached as proof; "Tagged only" = linked by tag but not yet attached.
 */
export function EvidenceSupportPanel({
  support,
  projectId,
  title = "Supporting evidence",
}: {
  support: EvidenceSupport;
  projectId: string;
  title?: string;
}) {
  return (
    <section className="card mt-4" aria-label={title}>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Attached files are used as proof when reports are written. Each file shows the report statements that cite it.
      </p>
      {support.files.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No files yet. Upload evidence and choose this item to attach it.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {support.files.map((f) => (
            <li key={f.id} className="rounded-md border border-slate-200 p-3 text-sm dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/evidence/${f.id}`}>
                  {f.title}
                </Link>
                <span className="flex gap-2">
                  <Badge tone={f.attached ? "success" : "warning"}>{f.attached ? "Used in reports" : "Tagged only"}</Badge>
                  <Badge tone="neutral">{EVIDENCE_VERIFICATION_LABEL[f.verificationStatus] ?? f.verificationStatus.toLowerCase().replace(/_/g, " ")}</Badge>
                </span>
              </div>
              {f.citedBy.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                    Cited by {f.citedBy.length} statement{f.citedBy.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {f.citedBy.slice(0, 10).map((c) => (
                      <li key={c.claimId}>
                        <span className="font-medium">{c.sectionTitle}:</span> {c.text}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Not cited by any report statement yet.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
