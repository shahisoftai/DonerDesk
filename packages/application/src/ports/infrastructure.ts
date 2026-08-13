import type { TenantId } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";

export interface StoragePutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoragePutResult {
  url: string;
  key: string;
  size: number;
}

export interface IStorage {
  put(input: StoragePutInput): Promise<StoragePutResult>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
  remove(key: string): Promise<void>;
}

export interface ILLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionInput {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCompletionResult {
  text: string;
  parsed?: unknown;
  model: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ILLMProvider {
  readonly name: string;
  readonly model: string;
  readonly promptVersion: string;
  complete(input: LLMCompletionInput): Promise<LLMCompletionResult>;
}

export interface IPiiRedactor {
  redact(text: string): { redacted: string; redactionCount: number };
}

export interface IJobQueue {
  enqueue(name: string, payload: Record<string, unknown>): Promise<void>;
}

/**
 * Durable idempotency guard. Callers acquire a key before a write; a duplicate
 * key is rejected so retried / duplicate deliveries do not double-apply.
 */
export interface IdempotencyAcquireInput {
  key: string;
  tenantId: string;
  jobName: string;
  entityId: string;
}

export interface IIdempotencyStore {
  acquire(input: IdempotencyAcquireInput): Promise<Result<{ acquired: boolean }, DomainError>>;
}
