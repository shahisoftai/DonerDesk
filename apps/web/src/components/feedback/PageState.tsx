export function InlineError({ title, referenceId }: { title: string; referenceId?: string }) {
  return (
    <div className="card border-red-300 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">{title}</p>
      {referenceId && <p className="mt-1 text-xs text-red-600/70 dark:text-red-400/70">Reference: {referenceId}</p>}
      <p className="mt-1 text-xs text-red-600/70 dark:text-red-400/70">
        This information could not be loaded. Please try again.
      </p>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card text-sm text-slate-600 dark:text-slate-300">{children}</div>;
}

export function ErrorState({
  title,
  message,
  referenceId,
  onRetry,
}: {
  title: string;
  message?: string;
  referenceId?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card">
      <h2 className="text-sm font-medium text-red-700 dark:text-red-400">{title}</h2>
      {message && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      {referenceId && <p className="mt-1 text-xs text-slate-400">Reference: {referenceId}</p>}
      {onRetry && (
        <button type="button" className="btn-secondary mt-4 text-xs" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function PermissionState({ message = "You do not have permission to view this." }: { message?: string }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Access restricted</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </div>
  );
}
