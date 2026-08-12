import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type LogframeItem = { id: string; level: string; code?: string; title: string; description?: string };
type Indicator = { id: string; code: string; name: string; baseline: string; target: string; unit?: string };

export default async function LogframePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const data = await api<{ items: LogframeItem[]; indicators: Indicator[] }>(`/v1/projects/${resolvedParams.id}/logframe`, { token }).catch(() => ({ items: [], indicators: [] }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Logframe & indicators</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/logframe/new`}>Add item</Link>
      </header>

      <section className="mt-8">
        <h2 className="font-semibold">Hierarchy</h2>
        <div className="mt-3 space-y-2">
          {data.items.length === 0 && <div className="card text-sm text-slate-500">No logframe items yet.</div>}
          {data.items.map((i) => (
            <div key={i.id} className="card flex items-center justify-between">
              <div>
                <span className="font-mono text-xs uppercase">{i.level}</span>{" "}
                {i.code && <span className="font-mono text-xs text-slate-500">{i.code}</span>}{" "}
                <span className="font-semibold">{i.title}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold">Indicators</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Indicator</th>
                <th className="px-3 py-2 text-left">Baseline</th>
                <th className="px-3 py-2 text-left">Target</th>
              </tr>
            </thead>
            <tbody>
              {data.indicators.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-3 text-slate-500">No indicators yet.</td></tr>
              )}
              {data.indicators.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono">{i.code}</td>
                  <td className="px-3 py-2">{i.name}</td>
                  <td className="px-3 py-2">{i.baseline}</td>
                  <td className="px-3 py-2">{i.target}{i.unit ? ` ${i.unit}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
