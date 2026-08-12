export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/10 ${className ?? ""}`}
    />
  );
}
