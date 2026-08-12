import Link from "next/link";
import { requireSession, hasCapability } from "@/lib/server/auth-context";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage() {
  const ctx = await requireSession();
  const canEdit = hasCapability(ctx, "project.edit");
  return <div className="animate-fade-in"><h2 className="text-2xl font-bold">Project settings</h2><div className="card mt-6 max-w-2xl"><h3 className="font-semibold">Project configuration</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Project identity, dates, reporting schedule, and data mode are protected configuration. Current API support does not yet provide a complete safe editor for these fields.</p>{canEdit ? <p className="mt-3 text-sm text-warning-700 dark:text-warning-400">Editing remains unavailable until the full update contract and audit behavior are registered. Existing data is unchanged.</p> : <p className="mt-3 text-sm text-slate-500">You have read-only project access.</p>}<Link className="btn-secondary mt-4" href="/settings">Organization settings</Link></div></div>;
}
