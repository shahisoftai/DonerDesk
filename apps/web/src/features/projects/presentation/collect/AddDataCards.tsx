import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { addDataOptionsFor } from "@/features/projects/domain/add-data-options";
import type { ProjectFact } from "@/features/projects/domain/project-stages";
import { canReachProjectPage } from "@/features/projects/domain/role-project-pages";

/** The Collect stage's front page: every way to add data as one card, each opening the screen that owns the job (it writes nothing itself). */
export function AddDataCards({ projectId, capabilities, facts, role }: { projectId: string; capabilities: ReadonlySet<string>; facts: ReadonlySet<ProjectFact>; role: string | null }) {
  const options = addDataOptionsFor({ capabilities, facts, reachable: (p) => canReachProjectPage(role, p) });
  if (options.length === 0) {
    return <p className="card text-sm text-slate-600 dark:text-slate-300">Your role cannot add data to this project. Ask a project manager if you need to.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ways to add data">
      {options.map((o) => (
        <li key={o.id}>
          <Link href={`/projects/${projectId}${o.path}`} className="card flex h-full flex-col justify-between transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
            <span>
              <span className="block text-[14px] font-semibold">{o.title}</span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{o.when}</span>
            </span>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-300">Open <ArrowRight aria-hidden="true" className="h-4 w-4" /></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
