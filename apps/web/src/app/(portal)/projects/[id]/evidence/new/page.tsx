import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationSchema } from "@/lib/server/schemas";
import { EvidenceUploadQueue } from "@/features/evidence/presentation/EvidenceUploadQueue";

export const dynamic = "force-dynamic";

export default async function NewEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const orgResult = await gatewayRequest("/v1/organization", OrganizationSchema, ctx.token);
  const storageProvider = orgResult.ok ? orgResult.value.storageProvider : "LOCAL";
  const driveMode = storageProvider === "GOOGLE_DRIVE";

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold">Upload evidence</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {driveMode
          ? "Add one or more files — each is saved into your project's Google Drive folder. You can also link a file that is already in your Drive."
          : "Add one or more files. Each file is uploaded separately; AI tagging runs after upload where enabled."}
      </p>
      <EvidenceUploadQueue projectId={resolvedParams.id} storageProvider={storageProvider} />
    </div>
  );
}
