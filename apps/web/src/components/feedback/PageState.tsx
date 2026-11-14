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

/**
 * One empty state everywhere (v4): an icon, one sentence (or a title and a sentence) and at most one action. Older callers pass
 * only children and still render as before, centred.
 */
export function EmptyState({
  children,
  title,
  icon,
  action,
}: {
  children?: React.ReactNode;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 border-dashed px-6 py-10 text-center text-sm text-slate-600 shadow-none dark:text-slate-300">
      {icon && <div className="mb-1 grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700 [&_svg]:h-5 [&_svg]:w-5 dark:bg-brand-300/10 dark:text-brand-300">{icon}</div>}
      {title && <p className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</p>}
      {children && <div className="max-w-md">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
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
