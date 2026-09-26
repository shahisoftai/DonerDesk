import Anthropic from "@anthropic-ai/sdk";
import type { ILLMProvider, LLMCompletionInput } from "@donordesk/application";
import { StubLLMProvider } from "./stub.js";
import { OllamaProvider } from "../ai/ollama.js";
import { createPiiFirewall, type PiiPolicy } from "../ai/pii-firewall.js";

export type LLMProviderName = "stub" | "openai" | "anthropic" | "gemini" | "ollama" | "deepseek" | "minimax";

export interface LLMProviderConfig {
  provider: LLMProviderName;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  groupId?: string;
  /** Claude only: `output_config.effort` (low|medium|high|xhigh|max). Omitted = model default. */
  effort?: string;
}

/** Google's OpenAI-compatible Gemini endpoint. */
export const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
/** Default Claude model when a SuperAdmin config leaves the model blank. */
export const DEFAULT_CLAUDE_MODEL = "claude-opus-5";

type AdapterFactory = (config: LLMProviderConfig) => ILLMProvider;

const registry = new Map<LLMProviderName, AdapterFactory>();

function register(name: LLMProviderName, factory: AdapterFactory): void {
  registry.set(name, factory);
}

register("openai", (cfg) =>
  createOpenAIAdapter({
    name: "openai",
    apiKey: cfg.apiKey ?? process.env.OPENAI_API_KEY ?? "",
    model: cfg.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    baseUrl: cfg.baseUrl,
    timeoutMs: cfg.timeoutMs,
  }),
);

// Gemini through Google's OpenAI-compatible endpoint. No model default: Gemini
// model IDs change often, so the SuperAdmin config must name one (the
// connection test lists the models the key can use).
register("gemini", (cfg) => {
  const model = cfg.model ?? process.env.GEMINI_MODEL;
  if (!model) throw new Error("Gemini requires a model (set it in the SuperAdmin LLM configuration)");
  return createOpenAIAdapter({
    name: "gemini",
    apiKey: cfg.apiKey ?? process.env.GEMINI_API_KEY ?? "",
    model,
    baseUrl: cfg.baseUrl ?? GEMINI_OPENAI_BASE_URL,
    timeoutMs: cfg.timeoutMs,
  });
});

register("anthropic", (cfg) =>
  createAnthropicAdapter({
    apiKey: cfg.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
    model: cfg.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL,
    baseUrl: cfg.baseUrl,
    timeoutMs: cfg.timeoutMs,
    effort: cfg.effort,
  }),
);

register("ollama", (cfg) =>
  createOllamaAdapter({
    baseUrl: cfg.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    model: cfg.model ?? process.env.OLLAMA_MODEL ?? "llama3.2",
    timeoutMs: cfg.timeoutMs ?? 60000,
  }),
);

register("deepseek", (cfg) =>
  createDeepSeekAdapter({
    apiKey: cfg.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "",
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    timeoutMs: cfg.timeoutMs,
  }),
);

register("minimax", (cfg) =>
  createMiniMaxAdapter({
    apiKey: cfg.apiKey ?? process.env.MINIMAX_API_KEY ?? "",
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    groupId: cfg.groupId,
    timeoutMs: cfg.timeoutMs,
  }),
);

register("stub", () => new StubLLMProvider());

export function registerLLMProvider(name: LLMProviderName, factory: AdapterFactory): void {
  registry.set(name, factory);
}

export function createLLMProvider(config?: Partial<LLMProviderConfig>): ILLMProvider {
  const provider: LLMProviderName =
    config?.provider ??
    (process.env.LLM_PROVIDER as LLMProviderName | undefined) ??
    "stub";

  const factory = registry.get(provider);
  if (!factory) {
    throw new Error(`Unsupported LLM provider: ${String(provider)}`);
  }

  const fullConfig: LLMProviderConfig = {
    provider,
    model: config?.model,
    apiKey: config?.apiKey,
    baseUrl: config?.baseUrl,
    timeoutMs: config?.timeoutMs,
    groupId: config?.groupId,
    effort: config?.effort,
  };

  const adapter = factory(fullConfig);
  const configuredPolicy = (process.env.LLM_PII_POLICY ?? "redact") as PiiPolicy;
  if (!["reject", "redact", "transform", "allow"].includes(configuredPolicy)) {
    throw new Error(`Invalid LLM_PII_POLICY: ${configuredPolicy}`);
  }
  return withPiiFirewall(adapter, configuredPolicy);
}

export function withPiiFirewall(provider: ILLMProvider, policy: PiiPolicy = "redact"): ILLMProvider {
  const firewall = createPiiFirewall(policy);
  return {
    name: provider.name,
    model: provider.model,
    promptVersion: provider.promptVersion,
    async complete(input) {
      const system = firewall.apply(input.systemPrompt, policy);
      const user = firewall.apply(input.userPrompt, policy);
      if (policy === "reject" && (system.hasPii || user.hasPii)) {
        throw new Error("LLM request rejected because it contains PII");
      }
      const protectedText = (original: string, result: ReturnType<typeof firewall.apply>) =>
        result.redactedText ?? result.transformedText ?? original;
      return provider.complete({
        ...input,
        systemPrompt: protectedText(input.systemPrompt, system),
        userPrompt: protectedText(input.userPrompt, user),
      });
    },
  };
}

function createOllamaAdapter(config: { baseUrl: string; model: string; timeoutMs: number }): ILLMProvider {
  const provider = new OllamaProvider(config);
  return {
    name: "ollama",
    model: config.model,
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const fullPrompt = input.systemPrompt ? `${input.systemPrompt}\n\n${input.userPrompt}` : input.userPrompt;
      const result = await provider.complete(fullPrompt);
      return {
        text: result.text,
        model: result.model,
        promptVersion: "1.0.0",
        usage: { inputTokens: 0, outputTokens: result.tokens },
      };
    },
  };
}

/** OpenAI Chat Completions, also used for OpenAI-compatible providers (Gemini). */
function createOpenAIAdapter(config: { name: "openai" | "gemini"; apiKey: string; model: string; baseUrl?: string; timeoutMs?: number }): ILLMProvider {
  if (!config.apiKey) {
    throw new Error(config.name === "openai" ? "OPENAI_API_KEY is required for the OpenAI provider" : "A Gemini API key is required for the Gemini provider");
  }
  const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return {
    name: config.name,
    model: config.model,
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            ...(input.systemPrompt ? [{ role: "system" as const, content: input.systemPrompt }] : []),
            { role: "user" as const, content: input.userPrompt },
          ],
          max_tokens: input.maxTokens ?? 2048,
          temperature: input.temperature ?? 0.3,
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`${config.name} API error: ${response.status}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      return {
        text: data.choices[0]?.message.content ?? "",
        model: config.model,
        promptVersion: "1.0.0",
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}

// Models that support the server-side refusal fallback (`fallbacks: "default"`).
const CLAUDE_FALLBACK_MODELS = new Set(["claude-opus-5", "claude-fable-5-1"]);
// Current Claude models reject sampling parameters and budget-style thinking;
// adaptive thinking also spends from max_tokens, so never lowball it.
const CLAUDE_MIN_MAX_TOKENS = 16000;

/**
 * Claude via the official Anthropic SDK. No temperature (rejected by current
 * models), no prefill (unsupported); JSON shape comes from the prompt. A
 * `refusal` stop reason is an error so the caller falls back deterministically.
 */
function createAnthropicAdapter(config: { apiKey: string; model: string; baseUrl?: string; timeoutMs?: number; effort?: string }): ILLMProvider {
  if (!config.apiKey) throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider");
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: config.timeoutMs ?? 180_000,
    maxRetries: 1,
  });
  const useFallbacks = CLAUDE_FALLBACK_MODELS.has(config.model);
  return {
    name: "anthropic",
    model: config.model,
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const response = await client.beta.messages.create({
        model: config.model,
        max_tokens: Math.max(input.maxTokens ?? 0, CLAUDE_MIN_MAX_TOKENS),
        ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
        messages: [{ role: "user", content: input.userPrompt }],
        ...(config.effort ? { output_config: { effort: config.effort as "low" | "medium" | "high" | "xhigh" | "max" } } : {}),
        ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      if (response.stop_reason === "refusal") {
        throw new Error(`Anthropic API refusal${response.stop_details?.category ? ` (${response.stop_details.category})` : ""}`);
      }
      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      return {
        text,
        model: response.model,
        promptVersion: "1.0.0",
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}

function createDeepSeekAdapter(config: { apiKey: string; model?: string; baseUrl?: string; timeoutMs?: number }): ILLMProvider {
  if (!config.apiKey) throw new Error("DeepSeek API key is required");
  const model = config.model ?? "deepseek-chat";
  const baseUrl = config.baseUrl ?? "https://api.deepseek.com";
  return {
    name: "deepseek",
    model,
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(input.systemPrompt ? [{ role: "system" as const, content: input.systemPrompt }] : []),
            { role: "user" as const, content: input.userPrompt },
          ],
          max_tokens: input.maxTokens ?? 2048,
          temperature: input.temperature ?? 0.3,
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      };

      return {
        text: data.choices[0]?.message.content ?? "",
        model,
        promptVersion: "1.0.0",
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        },
      };
    },
  };
}

function createMiniMaxAdapter(config: { apiKey: string; model?: string; baseUrl?: string; groupId?: string; timeoutMs?: number }): ILLMProvider {
  if (!config.apiKey) throw new Error("MiniMax API key is required");
  const model = config.model ?? "MiniMax-Text-01";
  const baseUrl = config.baseUrl ?? "https://api.minimax.io/v1";
  return {
    name: "minimax",
    model,
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const url = new URL(`${baseUrl}/text/chatcompletion_v2`);
      if (config.groupId) url.searchParams.set("GroupId", config.groupId);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(input.systemPrompt ? [{ role: "system" as const, content: input.systemPrompt }] : []),
            { role: "user" as const, content: input.userPrompt },
          ],
          max_tokens: input.maxTokens ?? 2048,
          temperature: input.temperature ?? 0.3,
        }),
        // MiniMax is slow (measured 46-54s for a full report draft); keep a
        // generous default so the call completes instead of aborting. A full
        // donor report with sections, evidence, and activity records can push
        // the call past 120s, so default to 180s.
        signal: AbortSignal.timeout(config.timeoutMs ?? 180000),
      });

      if (!response.ok) {
        throw new Error(`MiniMax API error: ${response.status}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        base_resp?: { status_code?: number };
        usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
      };

      if (data.base_resp && data.base_resp.status_code && data.base_resp.status_code !== 0) {
        throw new Error(`MiniMax API error: base_resp status ${data.base_resp.status_code}`);
      }

      const content = data.choices?.[0]?.message?.content ?? "";
      const totalTokens = data.usage?.total_tokens ?? 0;
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? totalTokens;

      return {
        text: content,
        model,
        promptVersion: "1.0.0",
        usage: {
          inputTokens: promptTokens,
          outputTokens: completionTokens,
        },
      };
    },
  };
}
