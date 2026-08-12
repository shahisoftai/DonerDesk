/**
 * Centralized date formatting. Render ISO timestamps through these helpers
 * rather than calling `new Date(...).toLocale...` ad hoc across components.
 */

export function parseDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export type DeadlineUrgency = { label: string; tone: "danger" | "warning" | "neutral" };

/**
 * Maps the number of days until a deadline to a display label and tone.
 * Negative values mean overdue.
 */
export function deadlineUrgency(days: number | null | undefined): DeadlineUrgency {
  if (days === null || days === undefined || Number.isNaN(days)) {
    return { label: "Unknown deadline", tone: "neutral" };
  }
  if (days < 0) return { label: "Overdue", tone: "danger" };
  if (days === 0) return { label: "Due today", tone: "danger" };
  if (days <= 3) return { label: `${days} day${days === 1 ? "" : "s"} left`, tone: "warning" };
  if (days <= 7) return { label: `${days} days left`, tone: "warning" };
  return { label: `${days} days left`, tone: "neutral" };
}
