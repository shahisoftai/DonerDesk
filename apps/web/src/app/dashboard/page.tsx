import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";
import Link from "next/link";

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name || "Dashboard"}</h1>
          <p className="text-sm text-slate-500">Reports, evidence, and compliance at a glance.</p>
        </div>
        <div className="flex gap-3">
          <Link className="btn-secondary" href="/projects/new">New project</Link>
          <Link className="btn-secondary" href="/team">Team</Link>
          <Link className="btn-secondary" href="/logout">Log out</Link>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <Card label="Active projects" value={String(projects.items.filter((p) => p.status === "ACTIVE").length)} hint={`${projects.items.length} total`} />
        <Card label="Reports due this month" value="0" hint="Computed in next release" />
        <Card label="Missing evidence" value="0" hint="Computed from checklist" />
        <Card label="Pending reviews" value="0" hint="Reports awaiting approval" />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent projects</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {projects.items.length === 0 && (
            <div className="card text-sm text-slate-600">
              No projects yet. <Link className="text-brand-600 hover:underline" href="/projects/new">Create your first project</Link>.
            </div>
          )}
          {projects.items.slice(0, 6).map((p) => (
            <Link key={p.id} className="card hover:border-brand-300" href={`/projects/${p.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-xs text-slate-500">{p.donorName} · {p.country} · {p.reportingFrequency.toLowerCase().replace("_", " ")}</div>
                </div>
                <span className={`tag ${p.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>{p.status}</span>
              </div>
              <div className="mt-3 text-xs text-slate-500">{p.daysRemaining} days remaining</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <ul className="mt-3 space-y-2">
          {notifications.items.length === 0 && <li className="text-sm text-slate-500">No notifications yet.</li>}
          {notifications.items.slice(0, 6).map((n) => (
            <li key={n.id} className="card flex items-center justify-between">
              <span className="text-sm">{n.title}</span>
              <span className={`tag ${n.read ? "tag-slate" : "tag-blue"}`}>{n.read ? "Read" : "New"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}
