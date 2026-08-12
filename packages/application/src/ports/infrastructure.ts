import type { TenantId } from "@donordesk/domain";

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
