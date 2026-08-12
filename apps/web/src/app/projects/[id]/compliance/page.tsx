import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionToken } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function CompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  return (
    <main className="mx-auto max-w-3xl animate-fade-in px-6 py-8">
      <h1 className="text-2xl font-bold">Compliance</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Compliance checklist items are shown per reporting period.
      </p>
      <div className="card mt-6">
        <p className="text-sm">Open a reporting period from the Reports tab to view and resolve its checklist.</p>
        <Link href={`/projects/${resolvedParams.id}/reports`} className="btn-secondary mt-3 inline-block">Go to Reports</Link>
      </div>
    </main>
  );
}
