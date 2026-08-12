export type AppError =
  | { kind: "validation"; message: string; fields: Record<string, string[]>; referenceId?: string }
  | { kind: "unauthenticated"; message: string; referenceId?: string }
  | { kind: "forbidden"; message: string; referenceId?: string }
  | { kind: "not_found"; message: string; referenceId?: string }
  | { kind: "conflict"; message: string; referenceId?: string }
  | { kind: "rate_limited"; message: string; retryAfter?: number; referenceId?: string }
  | { kind: "unavailable"; message: string; retryable: boolean; referenceId?: string }
  | { kind: "unexpected"; message: string; referenceId?: string };

export function errorMessage(error: AppError): string {
  return error.message;
}
