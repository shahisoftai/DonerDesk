import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { BeneficiariesResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { BeneficiaryForm } from "@/features/workplan/presentation/BeneficiaryForm";
import { SubmissionImport } from "@/features/workplan/presentation/SubmissionImport";
import { BENEFICIARY_AGE_LABEL, BENEFICIARY_SEX_LABEL } from "@donordesk/domain/contexts/workplan/index.js";

export const dynamic = "force-dynamic";

/**
 * People the project reaches, by case code. Each is counted once. No names are held; a case code is the only identifier.
 */
export default async function BeneficiariesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const res = await gatewayRequest(`/v1/projects/${id}/beneficiaries`, BeneficiariesResponseSchema, ctx.token);
  if (!res.ok) return <InlineError title={res.error.message} referenceId={res.error.referenceId} />;
  const today = new Date().toISOString().slice(0, 10);
  const { items, counts } = res.value;
  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">People reached</h2>
        <p className="mt-1 text-sm text-slate-500">{counts.total} people, each counted once by case code.</p>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {Object.entries(counts.bySex).map(([k, n]) => <div key={k} className="card"><dt className="text-slate-500">{BENEFICIARY_SEX_LABEL[k as keyof typeof BENEFICIARY_SEX_LABEL] ?? k}</dt><dd className="text-lg font-semibold">{n}</dd></div>)}
        {Object.entries(counts.byAgeGroup).map(([k, n]) => <div key={k} className="card"><dt className="text-slate-500">{BENEFICIARY_AGE_LABEL[k as keyof typeof BENEFICIARY_AGE_LABEL] ?? k}</dt><dd className="text-lg font-semibold">{n}</dd></div>)}
      </dl>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th scope="col" className="py-2 pr-3 font-medium">Case code</th><th scope="col" className="py-2 pr-3 font-medium">Sex</th><th scope="col" className="py-2 pr-3 font-medium">Age group</th><th scope="col" className="py-2 pr-3 font-medium">Location</th><th scope="col" className="py-2 pr-3 font-medium">Joined</th></tr></thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {items.map((b) => (
              <tr key={b.id}><td className="py-2 pr-3 font-mono">{b.caseCode}</td><td className="py-2 pr-3">{BENEFICIARY_SEX_LABEL[b.sex as keyof typeof BENEFICIARY_SEX_LABEL] ?? b.sex}</td><td className="py-2 pr-3">{BENEFICIARY_AGE_LABEL[b.ageGroup as keyof typeof BENEFICIARY_AGE_LABEL] ?? b.ageGroup}</td><td className="py-2 pr-3">{b.location || "—"}</td><td className="py-2 pr-3">{b.enrolledOn}</td></tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-4 text-sm text-slate-500">No one added yet.</p>}
      </div>
      <BeneficiaryForm projectId={id} today={today} />
      <SubmissionImport projectId={id} />
    </div>
  );
}
