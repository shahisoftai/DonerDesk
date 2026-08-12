export type AutosaveState = "idle" | "saving" | "saved" | "failed" | "conflict";

const labels: Record<AutosaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  failed: "Save failed",
  conflict: "Conflict — newer version exists",
};

const colors: Record<AutosaveState, string> = {
  idle: "",
  saving: "text-slate-500 dark:text-slate-400",
  saved: "text-success-600 dark:text-success-400",
  failed: "text-danger-600 dark:text-danger-400",
  conflict: "text-warning-600 dark:text-warning-400",
};

export function AutosaveStatus({ state }: { state: AutosaveState }) {
  if (state === "idle") return null;
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 text-xs font-medium ${colors[state]}`}>
      {state === "saving" && <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />}
      {labels[state]}
    </span>
  );
}
