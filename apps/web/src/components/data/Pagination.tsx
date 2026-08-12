import Link from "next/link";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sep = basePath.includes("?") ? "&" : "?";
  const prevHref = page > 1 ? `${basePath}${sep}page=${page - 1}` : null;
  const nextHref = page < totalPages ? `${basePath}${sep}page=${page + 1}` : null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {prevHref ? (
          <Link className="btn-secondary px-3 py-1 text-xs" href={prevHref}>
            Previous
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none px-3 py-1 text-xs opacity-50">Previous</span>
        )}
        {nextHref ? (
          <Link className="btn-secondary px-3 py-1 text-xs" href={nextHref}>
            Next
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none px-3 py-1 text-xs opacity-50">Next</span>
        )}
      </div>
    </nav>
  );
}
