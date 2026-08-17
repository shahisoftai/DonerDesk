import type { ILLMProvider, LLMCompletionInput } from "@donordesk/application";
import { StubLLMProvider } from "./stub.js";
import { OllamaProvider } from "../ai/ollama.js";
import { createPiiFirewall, type PiiPolicy } from "../ai/pii-firewall.js";

export type LLMProviderName = "stub" | "openai" | "anthropic" | "ollama" | "deepseek" | "minimax";

export interface LLMProviderConfig {
  provider: LLMProviderName;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  groupId?: string;
}

type AdapterFactory = (config: LLMProviderConfig) => ILLMProvider;

const registry = new Map<LLMProviderName, AdapterFactory>();

function register(name: LLMProviderName, factory: AdapterFactory): void {
  registry.set(name, factory);
}

register("openai", (cfg) =>
  createOpenAIAdapter({
    apiKey: cfg.apiKey ?? process.env.OPENAI_API_KEY ?? "",
    model: cfg.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    baseUrl: cfg.baseUrl,
    timeoutMs: cfg.timeoutMs,
  }),
);

register("anthropic", (cfg) =>
  createAnthropicAdapter({
    apiKey: cfg.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
    model: cfg.model ?? process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku",
    baseUrl: cfg.baseUrl,
    timeoutMs: cfg.timeoutMs,
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

function createOpenAIAdapter(config: { apiKey: string; model: string; baseUrl?: string; timeoutMs?: number }): ILLMProvider {
  if (!config.apiKey) throw new Error("OPENAI_API_KEY is required for the OpenAI provider");
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  return {
    name: "openai",
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
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      };

      return {
        text: data.choices[0]?.message.content ?? "",
        model: config.model,
        promptVersion: "1.0.0",
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        },
      };
    },
  };
}

function createAnthropicAdapter(config: { apiKey: string; model: string; baseUrl?: string; timeoutMs?: number }): ILLMProvider {
  if (!config.apiKey) throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider");
  const baseUrl = config.baseUrl ?? "https://api.anthropic.com";
  return {
    name: "anthropic",
    model: config.model,
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: input.maxTokens ?? 2048,
          system: input.systemPrompt || undefined,
          messages: [{ role: "user", content: input.userPrompt }],
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json() as {
        content: Array<{ text: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };

      return {
        text: data.content[0]?.text ?? "",
        model: config.model,
        promptVersion: "1.0.0",
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
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
        signal: AbortSignal.timeout(config.timeoutMs ?? 60000),
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
