import Link from "next/link";
import { CalendarClock, FileUp, PencilLine } from "lucide-react";
import type { AuthContext } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { PageHeader, Section } from "@/components/layout/Page";
import { EmptyState, InlineError } from "@/components/feedback/PageState";
import { formatDate } from "@/lib/shared/dates";

/** A report still being prepared: anything not yet approved, submitted, closed or cancelled (the period-lock statuses). */
const FINISHED = new Set(["APPROVED", "SUBMITTED", "CLOSED", "CANCELLED"]);

/**
 * An outside partner's landing page (Version 4.000, plan F37): the projects they were given, each with its next report
 * deadline and the two things a partner does there (enter values, add evidence). Reads only routes on the partner allow-list.
 */
export async function PartnerHome({ ctx }: { ctx: AuthContext }) {
  const projects = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projects.ok) return <InlineError title={projects.error.message} referenceId={projects.error.referenceId} />;
  const rows = await Promise.all(projects.value.items.map(async (p) => {
    const periods = await gatewayRequest(`/v1/projects/${encodeURIComponent(p.id)}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token);
    const next = periods.ok
      ? periods.value.items.filter((r) => !FINISHED.has(String(r.status))).sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
      : undefined;
    return { project: p, next };
  }));
  const today = new Date().toISOString().slice(0, 10);
  const canEnter = ctx.capabilities.has("indicator.update");
  const canUpload = ctx.capabilities.has("evidence.upload");
  return (
    <div className="page-stack animate-fade-in">
      <PageHeader title="Your projects" description="The projects you were invited to, with the next report each one is preparing." />
      {rows.length === 0 ? (
        <EmptyState title="No projects yet">You will see a project here as soon as the organisation that invited you adds you to one.</EmptyState>
      ) : (
        <Section title="What is next" bare>
          <ul className="grid gap-4 lg:grid-cols-2">
            {rows.map(({ project, next }) => (
              <li key={project.id} className="card flex flex-col gap-3">
                <div>
                  <Link href={`/projects/${project.id}`} className="link-quiet text-[15px] font-semibold">{project.title}</Link>
                  <p className="mt-0.5 text-xs text-slate-500">{[project.projectCode, project.donorName, project.country].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <CalendarClock aria-hidden="true" className="h-4 w-4 text-slate-400" />
                  {next ? (
                    <span>Next report due <b className={next.deadline < today ? "text-red-700 dark:text-red-400" : undefined}>{formatDate(next.deadline)}</b>{next.deadline < today ? " (late)" : ""}</span>
                  ) : <span>No report is being prepared.</span>}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {canEnter && <Link className="btn-primary btn-sm" href={`/projects/${project.id}/enter`}><PencilLine aria-hidden="true" />Enter values</Link>}
                  {canUpload && <Link className="btn-secondary btn-sm" href={`/projects/${project.id}/evidence/new`}><FileUp aria-hidden="true" />Add evidence</Link>}
                  <Link className="btn-ghost btn-sm" href={`/projects/${project.id}`}>Open project</Link>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
