import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  description,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const hasError = Boolean(error);
  const describedBy = [description ? `${htmlFor}-desc` : "", error ? `${htmlFor}-error` : "", hint ? `${htmlFor}-hint` : ""]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {description && (
        <p id={htmlFor ? `${htmlFor}-desc` : undefined} className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      <div aria-describedby={describedBy} aria-invalid={hasError || undefined}>
        {children}
      </div>
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1 text-xs font-medium text-danger-700 dark:text-danger-500">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
