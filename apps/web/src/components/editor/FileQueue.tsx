export type QueueFileState = "pending" | "uploading" | "succeeded" | "failed";

export type QueueFile = {
  key: string;
  name: string;
  state: QueueFileState;
  error?: string;
};

export function FileQueue({
  files,
  onRemove,
  onRetry,
}: {
  files: QueueFile[];
  onRemove?: (key: string) => void;
  onRetry?: (key: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Upload queue">
      {files.map((file) => (
        <li
          key={file.key}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
        >
          <span className="min-w-0 break-words leading-5">{file.name}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs">
            {file.state === "uploading" && <span className="animate-pulse text-slate-500">Uploading…</span>}
            {file.state === "succeeded" && <span className="text-success-600 dark:text-success-400">Done</span>}
            {file.state === "failed" && <span className="text-danger-600 dark:text-danger-400">Failed{file.error ? `: ${file.error}` : ""}</span>}
            {file.state === "failed" && onRetry && (
              <button type="button" className="text-brand-600 hover:underline dark:text-brand-300" onClick={() => onRetry(file.key)}>
                Retry
              </button>
            )}
            {onRemove && file.state !== "uploading" && (
              <button type="button" aria-label={`Remove ${file.name}`} className="rounded p-0.5 text-slate-400 hover:text-slate-600" onClick={() => onRemove(file.key)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
