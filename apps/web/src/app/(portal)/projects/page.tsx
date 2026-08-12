import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { Pagination } from "@/components/data/Pagination";
import { projectStatusTone } from "@/lib/shared/tone";
import { PermissionGate } from "@/components/permissions/PermissionGate";
import {
  filterProjects,
  sortProjects,
  PROJECT_PAGE_SIZE,
  DEFAULT_PROJECT_FILTERS,
  type ProjectFilters,
  type PortfolioProject,
} from "@/features/projects/presentation/project-portfolio";
import { SECTOR_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProjectsList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ctx = await requireSession();
  const result = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);

  const raw = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v : "";
  };
  const filters: ProjectFilters = {
    query: raw("q") || DEFAULT_PROJECT_FILTERS.query,
    status: raw("status") || DEFAULT_PROJECT_FILTERS.status,
    sector: raw("sector") || DEFAULT_PROJECT_FILTERS.sector,
    sort: isSort(raw("sort")) ? (raw("sort") as ProjectFilters["sort"]) : DEFAULT_PROJECT_FILTERS.sort,
    page: Math.max(1, Number.parseInt(raw("page"), 10) || 1),
    archived: raw("archived") === "true",
  };

  const projects: PortfolioProject[] = result.ok ? result.value.items : [];
  const sectors = [...new Set(projects.map((p) => p.sector).filter((s): s is string => Boolean(s)))];
  const filtered = result.ok ? filterProjects(projects, filters) : [];
  const sorted = result.ok ? sortProjects(filtered, filters.sort) : [];
  const total = sorted.length;
  const rows = result.ok ? sorted.slice((filters.page - 1) * PROJECT_PAGE_SIZE, filters.page * PROJECT_PAGE_SIZE) : [];

  const qs = (patch: Partial<ProjectFilters>) => {
    const url = new URLSearchParams();
    const next = { ...filters, ...patch };
    if (next.query) url.set("q", next.query);
    if (next.status !== "all") url.set("status", next.status);
    if (next.sector !== "all") url.set("sector", next.sector);
    if (next.sort !== "deadline") url.set("sort", next.sort);
    if (next.page > 1) url.set("page", String(next.page));
    if (next.archived) url.set("archived", "true");
    return `/projects${url.toString() ? `?${url.toString()}` : ""}`;
  };

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <PermissionGate capabilities={ctx.capabilities} capability="project.create">
          <Link className="btn" href="/projects/new">New project</Link>
        </PermissionGate>
      </header>

      <form method="get" action="/projects" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[200px] text-xs font-medium text-slate-500 dark:text-slate-400">
          Search
          <input name="q" defaultValue={filters.query} placeholder="Title, code, donor, country" className="input mt-1" />
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Status
          <select name="status" defaultValue={filters.status} className="input mt-1">
            <option value="all">All</option>
            {["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Sector
          <select name="sector" defaultValue={filters.sector} className="input mt-1">
            <option value="all">All</option>
            {sectors.map((s) => <option key={s} value={s}>{SECTOR_LABEL[s] ?? s}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Sort
          <select name="sort" defaultValue={filters.sort} className="input mt-1">
            <option value="deadline">Soonest deadline</option>
            <option value="title">Title</option>
            <option value="updated">End date</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <input type="checkbox" name="archived" value="true" defaultChecked={filters.archived} className="mt-1" />
          Show archived
        </label>
        <button className="btn" type="submit">Apply</button>
        {filters.query || filters.status !== "all" || filters.sector !== "all" || filters.archived ? (
          <Link className="btn-secondary" href="/projects">Clear</Link>
        ) : null}
      </form>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{total} project{total === 1 ? "" : "s"}</p>

      {!result.ok && <div className="mt-4"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>}

      {result.ok && rows.length === 0 && <div className="mt-4"><EmptyState>No projects match these filters.</EmptyState></div>}

      {result.ok && rows.length > 0 && (
        <>
          <div className="table-shell mt-4 hidden md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Projects</caption>
              <thead className="thead">
                <tr>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">Donor</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Days left</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="trow">
                    <td className="px-3 py-2"><Link className="font-medium hover:text-brand-700 dark:hover:text-brand-300" href={`/projects/${p.id}`}>{p.title}</Link><div className="text-xs text-slate-400">{p.country} · {p.sector ? (SECTOR_LABEL[p.sector] ?? p.sector) : "—"}</div></td>
                    <td className="px-3 py-2">{p.donorName}</td>
                    <td className="px-3 py-2"><Badge tone={projectStatusTone(p.status)}>{p.status}</Badge></td>
                    <td className="px-3 py-2">{p.daysRemaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 md:hidden">
            {rows.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{p.title}</span>
                  <Badge tone={projectStatusTone(p.status)}>{p.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{p.donorName} · {p.country}</div>
                <div className="mt-2 text-xs text-slate-400">{p.daysRemaining} days remaining</div>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <Pagination page={filters.page} pageSize={PROJECT_PAGE_SIZE} total={total} basePath={qs({})} />
          </div>
        </>
      )}
    </div>
  );
}

function isSort(v: string): v is ProjectFilters["sort"] {
  return v === "updated" || v === "deadline" || v === "title";
}
