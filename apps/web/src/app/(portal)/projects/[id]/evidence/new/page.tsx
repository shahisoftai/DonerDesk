import { EvidenceUploadQueue } from "@/features/evidence/presentation/EvidenceUploadQueue";

export default async function NewEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold">Upload evidence</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Add one or more files. Each file is uploaded separately; AI tagging runs after upload where enabled.
      </p>
      <EvidenceUploadQueue projectId={resolvedParams.id} />
    </div>
  );
}
