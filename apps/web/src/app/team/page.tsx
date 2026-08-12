import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

type User = { id: string; name: string; email: string; role: string; status: string };

export default async function TeamPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const { items } = await api<{ items: User[] }>("/v1/users", { token }).catch(() => ({ items: [] }));
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold">Team</h1>
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-slate-500">No team members yet.</td></tr>}
            {items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] ?? u.role}</td>
                <td className="px-3 py-2"><span className={`tag ${u.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>{u.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
