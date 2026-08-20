import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { EvidenceResponseSchema, OrganizationSchema } from "@/lib/server/schemas";
import {
  parseEvidenceFilters,
  serializeEvidenceFilters,
  withEvidenceFilter,
} from "@/lib/shared/evidence-filters";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { Pagination } from "@/components/data/Pagination";
import { verificationStatusTone, confidentialityTone } from "@/lib/shared/tone";
import { EVIDENCE_TYPE_LABEL, EVIDENCE_VERIFICATION_LABEL, CONFIDENTIALITY_LABEL } from "@/lib/labels";
import { EvidenceFilterBar } from "@/features/evidence/presentation/EvidenceFilterBar";
import { DriveFolderPanel } from "@/features/evidence/presentation/DriveFolderPanel";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function EvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const raw = await searchParams;
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") entries.push([key, value]);
  }
  const filters = parseEvidenceFilters(entries);

  const ctx = await requireSession();
  const [result, orgResult] = await Promise.all([
    gatewayRequest(`/v1/evidence/search`, EvidenceResponseSchema, ctx.token, {
      method: "POST",
      body: {
        projectId: resolvedParams.id,
        query: filters.query,
        verificationStatus: filters.verificationStatus,
        confidentialityLevel: filters.confidentialityLevel,
        evidenceType: filters.evidenceType,
        page: filters.page ?? 1,
        pageSize: PAGE_SIZE,
      },
    }),
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
  ]);
  const driveConnected = orgResult.ok && orgResult.value.storageProvider === "GOOGLE_DRIVE";

  const baseUrl = `/projects/${resolvedParams.id}/evidence`;

  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Evidence library</h1>
          <Link className="btn" href={`${baseUrl}/new`}>Upload evidence</Link>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  const { items, total } = result.value;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageBasePath = `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(filters, "page", undefined))}`;
  const queryString = new URLSearchParams(entries).toString();

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Evidence library</h1>
        <div className="flex gap-2">
          <a className="btn-secondary text-xs" href="/api/templates/evidence">Download template</a>
          <Link className="btn-secondary text-xs" href={`${baseUrl}/import`}>Import</Link>
          <Link className="btn" href={`${baseUrl}/new`}>Upload evidence</Link>
        </div>
      </header>

      <div className="mt-4">
        <EvidenceFilterBar baseUrl={baseUrl} current={queryString} />
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{total} file(s).</p>

      {items.length === 0 ? (
        <div className="card mt-4 text-sm text-slate-600 dark:text-slate-300">
          No evidence matches these filters.{" "}
          {Object.keys(filters).length > 0 ? (
            <Link className="text-brand-600 hover:underline dark:text-brand-400" href={baseUrl}>Clear filters</Link>
          ) : (
            "Upload your first file to get started."
          )}
        </div>
      ) : (
        <>
          <div className="table-shell mt-4">
            <table className="w-full text-sm">
              <caption className="sr-only">Evidence files in this project</caption>
              <thead className="thead">
                <tr>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Verification</th>
                  <th className="px-3 py-2 text-left">Confidentiality</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="trow">
                    <td className="px-3 py-2">
                      <Link href={`${baseUrl}/${e.id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                        {e.title}
                      </Link>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{e.fileName}</span>
                    </td>
                    <td className="px-3 py-2">{EVIDENCE_TYPE_LABEL[e.evidenceType] ?? e.evidenceType.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2">
                      <Badge tone={verificationStatusTone(e.verificationStatus)}>
                        {EVIDENCE_VERIFICATION_LABEL[e.verificationStatus] ?? e.verificationStatus.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={confidentialityTone(e.confidentialityLevel)}>
                        {CONFIDENTIALITY_LABEL[e.confidentialityLevel] ?? e.confidentialityLevel.replace(/_/g, " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={pageBasePath} />
            </div>
          )}
        </>
      )}

      {driveConnected && (
        <div className="mt-6">
          <DriveFolderPanel
            projectId={resolvedParams.id}
            folderRoles={["04-Evidence-Reports", "05-Evidence-Images"]}
            title="Google Drive evidence folder"
            linkAsEvidence
          />
        </div>
      )}
    </div>
  );
}
