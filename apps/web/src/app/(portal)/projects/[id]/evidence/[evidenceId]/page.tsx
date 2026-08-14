import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { EvidenceDetailSchema, CommentsResponseSchema } from "@/lib/server/schemas";
import { hasCapability } from "@/lib/server/auth-context";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { verificationStatusTone, confidentialityTone } from "@/lib/shared/tone";
import {
  EVIDENCE_TYPE_LABEL,
  EVIDENCE_VERIFICATION_LABEL,
  CONFIDENTIALITY_LABEL,
} from "@/lib/labels";
import { formatDate, formatFileSize } from "@/lib/shared/dates";
import { protectedFileDownloadHref, isByteStoredEvidence } from "@/lib/shared/downloads";
import { EvidenceTagReview } from "@/features/evidence/presentation/EvidenceTagReview";
import { EvidenceVerificationPanel } from "@/features/evidence/presentation/EvidenceVerificationPanel";
import { CommentsThread } from "@/features/comments/presentation/CommentsThread";

export const dynamic = "force-dynamic";

export default async function EvidenceDetailPage({
  params,
}: {
  params: Promise<{ id: string; evidenceId: string }>;
}) {
  const resolvedParams = await params;
  const ctx = await requireSession();

  const [detailResult, commentsResult] = await Promise.all([
    gatewayRequest(`/v1/evidence/${resolvedParams.evidenceId}`, EvidenceDetailSchema, ctx.token),
    gatewayRequest(
      `/v1/comments?entityType=evidence&entityId=${resolvedParams.evidenceId}`,
      CommentsResponseSchema,
      ctx.token,
    ),
  ]);

  if (!detailResult.ok) {
    if (detailResult.error.kind === "not_found") notFound();
    return <InlineError title={detailResult.error.message} referenceId={detailResult.error.referenceId} />;
  }
  const evidence = detailResult.value;
  const sensitive = evidence.confidentialityLevel === "SENSITIVE" || evidence.confidentialityLevel === "HIGHLY_SENSITIVE";
  const canVerify = hasCapability(ctx, "evidence.verify");
  const demoMode = process.env.NODE_ENV !== "production";

  // fileUrl is a protected API path like /v1/files/{tenantId/evidence/id.ext} for
  // byte-stored evidence, or a Google Drive web link for Drive-backed evidence.
  const hasProtectedDownload = isByteStoredEvidence(evidence.storageProvider, evidence.fileUrl);
  const downloadHref = protectedFileDownloadHref(evidence.fileUrl, evidence.fileName);
  const driveBacked = evidence.storageProvider === "GOOGLE_DRIVE";
  const driveLink = evidence.driveWebLink || evidence.fileUrl;

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{evidence.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{evidence.fileName}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={verificationStatusTone(evidence.verificationStatus)}>
            {EVIDENCE_VERIFICATION_LABEL[evidence.verificationStatus] ?? evidence.verificationStatus.replace(/_/g, " ")}
          </Badge>
          <Badge tone={confidentialityTone(evidence.confidentialityLevel)}>
            {CONFIDENTIALITY_LABEL[evidence.confidentialityLevel] ?? evidence.confidentialityLevel.replace(/_/g, " ")}
          </Badge>
        </div>
      </header>

      {sensitive && (
        <div role="alert" className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-4">
          <p className="text-sm font-semibold text-danger-700 dark:text-danger-400">
            Confidential file
          </p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            This file is marked {CONFIDENTIALITY_LABEL[evidence.confidentialityLevel]}. Be careful who you share or
            download it with, and exclude it from exports unless explicitly required.
          </p>
        </div>
      )}

      <section className="card" aria-label="Evidence metadata">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Type</dt>
            <dd className="font-medium">{EVIDENCE_TYPE_LABEL[evidence.evidenceType] ?? evidence.evidenceType.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Size</dt>
            <dd className="font-medium">{formatFileSize(evidence.fileSize)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Uploaded</dt>
            <dd className="font-medium">{evidence.activityDate ? formatDate(evidence.activityDate) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Location</dt>
            <dd className="font-medium">{evidence.location ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap">{evidence.notes ?? "—"}</dd>
          </div>
        </dl>
        {hasProtectedDownload && (
          <a className="btn mt-4" href={downloadHref}>
            Download file
          </a>
        )}
        {driveBacked && (
          <a className="btn mt-4" href={driveLink} target="_blank" rel="noopener noreferrer">
            Open in Google Drive
          </a>
        )}
      </section>

      {evidence.aiSummary && (
        <section className="card" aria-label="AI summary">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">AI summary</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{evidence.aiSummary}</p>
        </section>
      )}

      {evidence.sensitivityWarning && (
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-500/5 p-4">
          <p className="text-sm text-warning-700 dark:text-warning-400">{evidence.sensitivityWarning}</p>
        </div>
      )}

      <EvidenceTagReview evidenceId={evidence.id} tags={evidence.aiSuggestedTags ?? []} demoMode={demoMode} />

      {canVerify && (
        <EvidenceVerificationPanel
          evidenceId={evidence.id}
          verificationStatus={evidence.verificationStatus}
          sensitive={sensitive}
        />
      )}

      <CommentsThread
        entityType="evidence"
        entityId={evidence.id}
        initialComments={commentsResult.ok ? commentsResult.value.items : []}
      />

      <div className="flex gap-3">
        <Link className="btn-secondary" href={`/projects/${evidence.projectId}/evidence`}>
          Back to evidence library
        </Link>
      </div>
    </div>
  );
}
