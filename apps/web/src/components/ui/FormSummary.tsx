export function FormSummary({ errors, count }: { errors: Record<string, string[]>; count?: number }) {
  const list = Object.entries(errors);
  if (list.length === 0) return null;
  const total = count ?? list.reduce((sum, [, messages]) => sum + messages.length, 0);
  return (
    <div role="alert" className="rounded-xl border border-danger-500/30 bg-danger-50/70 p-3 dark:bg-danger-500/10">
      <p className="text-sm font-semibold text-danger-700 dark:text-danger-500">
        Please fix {total} issue{total === 1 ? "" : "s"}.
      </p>
      <ul className="mt-1 list-inside list-disc text-xs text-danger-700/90 dark:text-danger-400/90">
        {list.map(([field, messages]) => (
          <li key={field}>
            {field}: {messages.join("; ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
