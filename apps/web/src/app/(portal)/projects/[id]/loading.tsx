import { Skeleton } from "@/components/feedback/Skeleton";

/** A project page loading inside the project shell: the section under the tabs takes the page's shape (plan F71). */
export default function ProjectPageLoading() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="Loading">
      <div className="card space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="grid gap-3 pt-2 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      </div>
      <div className="card space-y-2">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}
      </div>
    </div>
  );
}
