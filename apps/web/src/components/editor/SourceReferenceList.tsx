import { SourceChips, type SourceRef } from "@/components/data/SourceChips";

export function SourceReferenceList({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Sources</p>
      <SourceChips sources={sources} />
    </div>
  );
}
