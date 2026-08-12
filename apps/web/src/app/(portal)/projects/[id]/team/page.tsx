import Link from "next/link";
import { requireSession, hasCapability } from "@/lib/server/auth-context";

export const dynamic = "force-dynamic";

export default async function ProjectTeamPage() {
  const ctx = await requireSession();
  const canManage = hasCapability(ctx, "team.manage") || hasCapability(ctx, "team.invite");
  return <div className="animate-fade-in"><h2 className="text-2xl font-bold">Project team</h2><div className="card mt-6 max-w-2xl"><p className="text-sm text-slate-600 dark:text-slate-300">Project assignments are managed with the organization team so role and access changes remain consistent and auditable.</p>{canManage ? <Link className="btn mt-4" href="/team">Manage team and assignments</Link> : <p className="mt-3 text-sm text-slate-500">You do not have permission to change team access.</p>}</div></div>;
}
