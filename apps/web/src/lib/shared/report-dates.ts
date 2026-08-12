export interface ReportDateInputs {
  startDate?: string | null;
  endDate?: string | null;
  deadline?: string | null;
  internalReviewDeadline?: string | null;
}

export type ReportDateFieldErrors = Record<string, string[]>;

/**
 * Validates that a reporting period's dates are present and coherent:
 * start ≤ end, end ≤ donor deadline, and any internal deadline precedes the
 * donor deadline. Accepts ISO date/datetime strings.
 */
export function validateReportDates(input: ReportDateInputs): ReportDateFieldErrors {
  const errors: ReportDateFieldErrors = {};

  const start = toDate(input.startDate);
  const end = toDate(input.endDate);
  const deadline = toDate(input.deadline);
  const internal = toDate(input.internalReviewDeadline);

  if (!start) errors.startDate = ["Start date is required."];
  if (!end) errors.endDate = ["End date is required."];
  if (!deadline) errors.deadline = ["Donor deadline is required."];

  if (start && end && end.getTime() < start.getTime()) {
    errors.endDate = ["End date must be on or after the start date."];
  }
  if (end && deadline && deadline.getTime() < end.getTime()) {
    errors.deadline = ["Donor deadline must be on or after the end date."];
  }
  if (internal && deadline && internal.getTime() > deadline.getTime()) {
    errors.internalReviewDeadline = ["Internal review deadline must be on or before the donor deadline."];
  }

  return errors;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
