export type SourceRef = { type: string; id: string; label?: string };

export function SourceChips({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((source) => (
        <span
          key={`${source.type}-${source.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-brand-500/20 bg-brand-500/5 px-2 py-0.5 text-xs text-brand-700 dark:text-brand-300"
        >
          <span className="uppercase text-[10px] opacity-70">{source.type}</span>
          {source.label ?? source.id.slice(0, 8)}
        </span>
      ))}
    </div>
  );
}
