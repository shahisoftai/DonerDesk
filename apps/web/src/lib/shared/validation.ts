import type { ZodError, z } from "zod";
import { describeValidationIssue } from "@donordesk/contracts";

/**
 * Field errors keyed by the top-level field, each message naming the nested field it is about
 * ("Main needs (one per line): can be up to 200 characters…"), never a bare validator message.
 */
export function flattenZodFields(error: z.ZodError | ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    const text = issue.path.length > 1 ? describeValidationIssue(issue) : issue.message;
    (fields[key] ??= []).push(text);
  }
  return fields;
}
