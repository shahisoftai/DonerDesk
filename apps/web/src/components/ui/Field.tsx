import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

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
  // A control with no id of its own would leave the label unattached (a screen reader announces "combo box" and nothing
  // else): the field names its single child itself.
  const generatedId = useId();
  const only = Children.count(children) === 1 ? (Children.toArray(children)[0] as ReactNode) : null;
  const child = isValidElement(only) ? (only as ReactElement<{ id?: string }>) : null;
  const controlId = htmlFor ?? child?.props.id ?? (child ? generatedId : undefined);
  htmlFor = controlId;
  const control = child && child.props.id === undefined && controlId ? cloneElement(child, { id: controlId }) : children;
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
        {control}
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
