import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type Activity = { id: string; activityTitle: string; activityDate: string; location?: string; participantsTotal?: number; status: string };

export default async function ActivitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const { items } = await api<{ items: Activity[] }>(`/v1/projects/${resolvedParams.id}/activities`, { token }).catch(() => ({ items: [] }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity updates</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/activities/new`}>New activity</Link>
      </header>
      <div className="mt-6 space-y-3">
        {items.length === 0 && <div className="card text-sm text-slate-500">No activity updates yet.</div>}
        {items.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{a.activityTitle}</div>
                <div className="text-xs text-slate-500">{a.activityDate.slice(0, 10)} · {a.location ?? "—"} · {a.participantsTotal ?? 0} participants</div>
              </div>
              <span className={`tag ${a.status === "ACCEPTED" ? "tag-green" : a.status === "REJECTED" ? "tag-red" : "tag-amber"}`}>{a.status}</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
