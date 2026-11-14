import { Skeleton } from "@/components/feedback/Skeleton";

export default function PortalLoading() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="Loading">
      <div className="space-y-2 border-b border-slate-200 pb-5 dark:border-white/10"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
