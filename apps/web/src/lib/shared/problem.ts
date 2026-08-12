import type { AppError } from "./app-error.ts";

export type ProblemErrors = Array<{ path?: Array<string | number>; message?: string }>;

export type ProblemBody = {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  requestId?: string;
  errors?: ProblemErrors;
};

function titleFrom(body: ProblemBody, status: number): string {
  return typeof body.title === "string" && body.title.length > 0 ? body.title : `Request failed (HTTP ${status})`;
}

function referenceIdFrom(body: ProblemBody): string | undefined {
  return typeof body.requestId === "string" && body.requestId.length > 0 ? body.requestId : undefined;
}

function fieldsFrom(errors: ProblemErrors | undefined): Record<string, string[]> {
  if (!errors) return {};
  const fields: Record<string, string[]> = {};
  for (const entry of errors) {
    if (!entry) continue;
    const key = entry.path && entry.path.length > 0 ? entry.path.map(String).join(".") : "form";
    const list = fields[key] ?? [];
    list.push(entry.message ?? "Invalid value");
    fields[key] = list;
  }
  return fields;
}

export function parseProblem(status: number, rawBody: unknown): AppError {
  const body: ProblemBody =
    typeof rawBody === "object" && rawBody !== null ? (rawBody as ProblemBody) : {};
  const message = titleFrom(body, status);
  const referenceId = referenceIdFrom(body);

  switch (status) {
    case 400:
    case 422: {
      const fields = fieldsFrom(body.errors);
      if (Object.keys(fields).length > 0) {
        return { kind: "validation", message, fields, referenceId };
      }
      return { kind: "unexpected", message, referenceId };
    }
    case 401:
      return { kind: "unauthenticated", message, referenceId };
    case 403:
      return { kind: "forbidden", message, referenceId };
    case 404:
      return { kind: "not_found", message, referenceId };
    case 409:
      return { kind: "conflict", message, referenceId };
    case 429:
      return { kind: "rate_limited", message, referenceId };
    case 500:
    case 502:
    case 503:
    case 504:
      return { kind: "unavailable", message, retryable: status !== 500, referenceId };
    default:
      return { kind: "unexpected", message, referenceId };
  }
}

export function mergeReferenceId(error: AppError, referenceId: string | undefined): AppError {
  if (!referenceId || error.referenceId !== undefined) return error;
  return { ...error, referenceId };
}
