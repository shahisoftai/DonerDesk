import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { loadDashboard, type DashboardWidget } from "@/features/dashboard/application/dashboard-read-model";
import type { DeadlineBand } from "@/features/dashboard/presentation/deadline-bands";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { projectStatusTone, reportStatusTone } from "@/lib/shared/tone";

export const dynamic = "force-dynamic";

const BAND_LABEL: Record<DeadlineBand, string> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due within 3 days",
  later: "On track",
};

export default async function Dashboard() {
  const ctx = await requireSession();
  const snapshot = await loadDashboard(ctx.token);

  const projects = snapshot.projects.ok ? snapshot.projects.value ?? [] : [];
  const notifications = snapshot.notifications.ok ? snapshot.notifications.value ?? [] : [];
  const deadlines = snapshot.deadlineData.ok ? snapshot.deadlineData.value ?? [] : [];
  const pendingEvidence = snapshot.pendingEvidence.ok ? snapshot.pendingEvidence.value : null;

  const active = projects.filter((p) => p.status === "ACTIVE");
  const unread = notifications.filter((n) => !n.read);
  const dueSoon = deadlines.filter((d) => d.band === "overdue" || d.band === "today" || d.band === "soon");

  return (
    <div className="animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">Operational home</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">What needs your attention</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Authoritative counts from your workspace. Missing data is shown as unavailable, never as zero.
          </p>
        </div>
        <Link className="btn" href="/projects/new">+ New project</Link>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          label="Active projects"
          value={snapshot.projects.ok ? String(active.length) : null}
          href="/projects"
          hint={snapshot.projects.ok ? `${projects.length} total` : undefined}
          widget={snapshot.projects}
        />
        <CountCard
          label="Reports needing attention"
          value={snapshot.deadlineData.ok ? String(dueSoon.length) : null}
          href="/projects"
          hint="overdue, today, or within 3 days"
          widget={snapshot.deadlineData}
        />
        <CountCard
          label="Evidence pending review"
          value={pendingEvidence === null ? null : String(pendingEvidence)}
          href="/evidence"
          hint="awaiting verification"
          widget={snapshot.pendingEvidence}
        />
        <CountCard
          label="Unread notifications"
          value={snapshot.notifications.ok ? String(unread.length) : null}
          href="/notifications"
          hint={snapshot.notifications.ok ? `${notifications.length} total` : undefined}
          widget={snapshot.notifications}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">Deadline overview</h2>
        {!snapshot.deadlineData.ok && (
          <div className="mt-3"><InlineError title={snapshot.deadlineData.error?.message ?? "Deadlines unavailable"} referenceId={snapshot.deadlineData.error?.referenceId} /></div>
        )}
        {snapshot.deadlineData.ok && deadlines.length === 0 && (
          <div className="mt-3"><EmptyState>No reporting deadlines yet.</EmptyState></div>
        )}
        {snapshot.deadlineData.ok && deadlines.length > 0 && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {deadlines.map((d) => (
              <Link key={`${d.projectId}-${d.periodId}`} href={`/projects/${d.projectId}/reports/${d.periodId}`} className="card flex items-center justify-between gap-3 transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{d.projectTitle}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <Badge tone={reportStatusTone(d.periodStatus)}>{d.periodStatus.replace(/_/g, " ")}</Badge>
                    <span className="ml-2">{new Date(d.deadline).toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge tone={bandTone(d.band)}>{d.band ? BAND_LABEL[d.band] : "No deadline"}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent projects</h2>
            <Link href="/projects" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">View all →</Link>
          </div>
          {!snapshot.projects.ok && <div className="mt-3"><InlineError title={snapshot.projects.error?.message ?? "Projects unavailable"} referenceId={snapshot.projects.error?.referenceId} /></div>}
          {snapshot.projects.ok && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {projects.length === 0 && (
                <div className="card text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                  No projects yet. <Link className="font-semibold text-brand-600 hover:underline dark:text-brand-400" href="/projects/new">Create your first project</Link>.
                </div>
              )}
              {projects.slice(0, 6).map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.title}</div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">{p.donorName} · {p.country}</div>
                    </div>
                    <Badge tone={projectStatusTone(p.status)} className="shrink-0">{p.status.replace(/_/g, " ")}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Notifications</h2>
            <Link href="/notifications" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">Open inbox →</Link>
          </div>
          {!snapshot.notifications.ok && <div className="mt-3"><InlineError title={snapshot.notifications.error?.message ?? "Notifications unavailable"} referenceId={snapshot.notifications.error?.referenceId} /></div>}
          {snapshot.notifications.ok && (
            <ul className="mt-3 space-y-2">
              {notifications.length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No notifications yet.</li>}
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id} className="rounded-xl border border-slate-200/60 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">{n.title}</span>
                    <Badge tone={n.read ? "neutral" : "info"}>{n.read ? "Read" : "New"}</Badge>
                  </div>
                  {n.message && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function CountCard({
  label,
  value,
  hint,
  href,
  widget,
}: {
  label: string;
  value: string | null;
  hint?: string;
  href: string;
  widget: DashboardWidget<unknown>;
}) {
  const body = (
    <>
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value === null ? "—" : value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint ?? (value === null ? "unavailable" : "")}</div>
    </>
  );
  if (!widget.ok) {
    return (
      <div className="card" role="alert">
        {body}
        <p className="mt-2 text-xs text-danger-600 dark:text-danger-400">Could not load</p>
      </div>
    );
  }
  return (
    <Link href={href} className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
      {body}
    </Link>
  );
}

function bandTone(band: DeadlineBand | null): "info" | "success" | "warning" | "danger" | "neutral" | "ai" {
  switch (band) {
    case "overdue": return "danger";
    case "today": return "warning";
    case "soon": return "warning";
    case "later": return "success";
    default: return "neutral";
  }
}
