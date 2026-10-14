import type { ZodError } from "zod";
import { describeValidationIssue } from "@donordesk/contracts";

const MAX_ISSUES_IN_TITLE = 3;

/**
 * A human sentence for a failed request body, so an API caller (and the web app, which shows the
 * problem's title) never gets a bare "Validation failed" with the cause buried in an array.
 */
export function validationTitle(error: Pick<ZodError, "issues">): string {
  const parts = error.issues.slice(0, MAX_ISSUES_IN_TITLE).map((issue) => describeValidationIssue(issue));
  if (parts.length === 0) return "Validation failed";
  const more = error.issues.length - parts.length;
  return `Validation failed — ${parts.join("; ")}${more > 0 ? `; and ${more} more` : ""}`;
}
