import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

type Project = { id: string; title: string; status: string; donorName: string; country: string; reportingFrequency: string; daysRemaining: number };

export default async function Dashboard() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const [org, projects, notifications] = await Promise.all([
    api<{ name: string }>("/v1/organization", { token }).catch(() => ({ name: "" })),
    api<{ items: Project[] }>("/v1/projects", { token }).catch(() => ({ items: [] })),
    api<{ items: Array<{ id: string; title: string; read: boolean }> }>("/v1/notifications", { token }).catch(() => ({ items: [] })),
  ]);

  const active = projects.items.filter((p) => p.status === "ACTIVE");
  const avgDays = projects.items.length
    ? Math.round(projects.items.reduce((s, p) => s + Math.max(0, p.daysRemaining), 0) / projects.items.length)
    : 0;
  const health = Math.min(
    98,
    Math.max(8, 40 + Math.round((active.length / Math.max(1, projects.items.length)) * 40) + Math.round(Math.min(18, avgDays / 20))),
  );
  const onTrack = projects.items.filter((p) => p.daysRemaining > 30).length;
  const dueSoon = projects.items.filter((p) => p.daysRemaining <= 30 && p.daysRemaining >= 0).length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-black text-white shadow-lg shadow-brand-500/30">
              D
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold">{org.name || "DonorDesk"}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">Command center</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link className="btn-secondary hidden px-3 text-xs sm:inline-flex" href="/projects/new">New project</Link>
            <Link className="btn-secondary hidden px-3 text-xs md:inline-flex" href="/team">Team</Link>
            <Link className="btn-secondary px-3 text-xs" href="/logout">Log out</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl animate-fade-in px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">Live overview</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Reports, evidence &amp; compliance at a glance</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {active.length} active · {onTrack} on track · {dueSoon} due within 30 days
            </p>
          </div>
          <Link className="btn" href="/projects/new">+ New project</Link>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active projects"
            value={String(active.length)}
            hint={`${projects.items.length} total`}
            pct={projects.items.length ? Math.round((active.length / projects.items.length) * 100) : 0}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
            }
          />
          <StatCard
            label="On track"
            value={String(onTrack)}
            hint="deadline &gt; 30 days"
            pct={projects.items.length ? Math.round((onTrack / projects.items.length) * 100) : 0}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            }
          />
          <StatCard
            label="Due within 30 days"
            value={String(dueSoon)}
            hint="prioritize these reports"
            pct={projects.items.length ? Math.round((dueSoon / projects.items.length) * 100) : 0}
            warn={dueSoon > 0}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            }
          />
          <StatCard
            label="Unread alerts"
            value={String(notifications.items.filter((n) => !n.read).length)}
            hint="notifications pending"
            pct={notifications.items.length ? Math.round((notifications.items.filter((n) => !n.read).length / notifications.items.length) * 100) : 0}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            }
          />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent projects</h2>
              <Link href="/projects" className="text-sm font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">View all →</Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {projects.items.length === 0 && (
                <div className="card text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                  No projects yet. <Link className="font-semibold text-brand-600 hover:underline dark:text-brand-400" href="/projects/new">Create your first project</Link>.
                </div>
              )}
              {projects.items.slice(0, 6).map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="card relative overflow-hidden">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-brand-500/15 to-accent-400/15 blur-2xl" />
              <h2 className="font-bold">Workspace health</h2>
              <div className="mt-4 flex items-center justify-center">
                <Ring value={health} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-xl bg-slate-100/70 py-2 dark:bg-white/5">
                  <div className="font-bold">{projects.items.length}</div>
                  <div className="text-slate-500 dark:text-slate-400">projects</div>
                </div>
                <div className="rounded-xl bg-slate-100/70 py-2 dark:bg-white/5">
                  <div className="font-bold">{notifications.items.length}</div>
                  <div className="text-slate-500 dark:text-slate-400">alerts</div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold">Notifications</h2>
              <ul className="mt-3 space-y-2">
                {notifications.items.length === 0 && (
                  <li className="text-sm text-slate-500 dark:text-slate-400">No notifications yet.</li>
                )}
                {notifications.items.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white/60 px-4 py-3 backdrop-blur transition hover:border-brand-400/40 dark:border-white/10 dark:bg-white/[0.03]">
                    <span className="text-sm">{n.title}</span>
                    <span className={`tag ${n.read ? "tag-slate" : "tag-blue"}`}>{n.read ? "Read" : "New"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, hint, pct, warn, icon }: { label: string; value: string; hint: string; pct: number; warn?: boolean; icon: React.ReactNode }) {
  return (
    <div className="card group relative overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/40 dark:hover:border-brand-400/30">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-brand-500/15 to-accent-400/15 blur-2xl transition group-hover:from-brand-500/25 group-hover:to-accent-400/25" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500/15 to-accent-400/15 text-brand-700 dark:text-brand-300">
          {icon}
        </span>
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-700 ${warn ? "bg-gradient-to-r from-amber-500 to-red-500" : "bg-gradient-to-r from-brand-500 to-accent-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProjectCard({ p }: { p: Project }) {
  const pct = Math.min(100, Math.max(4, Math.round((p.daysRemaining / 365) * 100)));
  const urgent = p.daysRemaining <= 30;
  return (
    <Link href={`/projects/${p.id}`} className="card group transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/40 dark:hover:border-brand-400/30">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold transition group-hover:text-brand-700 dark:group-hover:text-brand-300">{p.title}</div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            {p.donorName} · {p.country} · {p.reportingFrequency.toLowerCase().replace("_", " ")}
          </div>
        </div>
        <span className={`tag shrink-0 ${p.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>{p.status}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${urgent ? "from-amber-500 to-red-500" : "from-brand-500 to-accent-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${urgent ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
          {p.daysRemaining}d
        </span>
      </div>
    </Link>
  );
}

function Ring({ value }: { value: number }) {
  const size = 132;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="health-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#36a8f6" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#health-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-3xl font-extrabold text-transparent">{value}%</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">health</div>
        </div>
      </div>
    </div>
  );
}
