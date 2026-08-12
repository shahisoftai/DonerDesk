import "server-only";
import { parseProblem, mergeReferenceId, type ProblemBody } from "@/lib/shared/problem";
import type { AppError } from "@/lib/shared/app-error";
import type { Result } from "@/lib/shared/result";
import type { ZodType } from "zod";

const DEFAULT_TIMEOUT_MS = 15_000;

const BASE_URL = resolveApiUrl();

export function apiBaseUrl(): string {
  return BASE_URL;
}

function resolveApiUrl(): string {
  const raw =
    process.env.API_INTERNAL_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4001";
  return raw.replace(/\/+$/, "");
}

export type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ProblemHeaders = { "x-request-id"?: string };

export async function gatewayRequest<T>(
  path: string,
  schema: ZodType<T>,
  token: string,
  options: GatewayRequestOptions = {},
): Promise<Result<T, AppError>> {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  headers.set("accept", "application/json");

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onOuterAbort, { once: true });

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    return await toResult(response, schema);
  } catch (error) {
    return { ok: false, error: toTransportError(error) };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }
}

async function toResult<T>(response: Response, schema: ZodType<T>): Promise<Result<T, AppError>> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const referenceId =
    (response.headers as unknown as ProblemHeaders)["x-request-id"] ?? undefined;

  if (!response.ok) {
    let parsed: unknown;
    if (contentType.includes("application/json") && text.length > 0) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = undefined;
      }
    }
    const body = parsed as ProblemBody | undefined;
    const parsedError = parseProblem(response.status, body);
    const error = mergeReferenceId(parsedError, referenceId);
    return { ok: false, error };
  }

  if (text.length === 0) {
    return { ok: true, value: schema.parse(undefined) as T };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: { kind: "unexpected", message: "Received an invalid JSON response.", referenceId } };
  }

  const parsedResult = schema.safeParse(parsed);
  if (!parsedResult.success) {
    return { ok: false, error: { kind: "unexpected", message: "Received an unexpected response shape.", referenceId } };
  }
  return { ok: true, value: parsedResult.data };
}

function toTransportError(error: unknown): AppError {
  const isAbort = error instanceof Error && error.name === "AbortError";
  if (isAbort) {
    return { kind: "unavailable", message: "The request timed out. Please try again.", retryable: true };
  }
  return { kind: "unavailable", message: "The service could not be reached. Please try again.", retryable: true };
}
