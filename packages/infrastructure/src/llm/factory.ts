import type { ILLMProvider, LLMCompletionInput } from "@donordesk/application";
import { StubLLMProvider } from "./stub.js";
import { OllamaProvider } from "../ai/ollama.js";
import { createPiiFirewall, type PiiPolicy } from "../ai/pii-firewall.js";

export interface LLMProviderConfig {
  provider: "stub" | "openai" | "anthropic" | "ollama";
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export function createLLMProvider(config?: Partial<LLMProviderConfig>): ILLMProvider {
  const provider = config?.provider ?? (process.env.LLM_PROVIDER as LLMProviderConfig["provider"]) ?? "stub";
  let adapter: ILLMProvider;
  switch (provider) {
    case "ollama":
      adapter = createOllamaAdapter({
        baseUrl: config?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        model: config?.model ?? process.env.OLLAMA_MODEL ?? "llama3.2",
        timeoutMs: config?.timeoutMs ?? 60000,
      });
      break;

    case "openai":
      adapter = createOpenAIAdapter({
        apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY ?? "",
        model: config?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        timeoutMs: config?.timeoutMs ?? 60000,
      });
      break;

    case "anthropic":
      adapter = createAnthropicAdapter({
        apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
        model: config?.model ?? process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku",
        timeoutMs: config?.timeoutMs ?? 60000,
      });
      break;

    case "stub":
      adapter = new StubLLMProvider();
      break;
    default:
      throw new Error(`Unsupported LLM provider: ${String(provider)}`);
  }
  const configuredPolicy = process.env.LLM_PII_POLICY ?? "redact";
  if (!["reject", "redact", "transform", "allow"].includes(configuredPolicy)) {
    throw new Error(`Invalid LLM_PII_POLICY: ${configuredPolicy}`);
  }
  return withPiiFirewall(adapter, configuredPolicy as PiiPolicy);
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
      if (policy === "reject" && (system.hasPii || user.hasPii)) throw new Error("LLM request rejected because it contains PII");
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

function createOpenAIAdapter(config: { apiKey: string; model: string; timeoutMs: number }): ILLMProvider {
  if (!config.apiKey) throw new Error("OPENAI_API_KEY is required for the OpenAI provider");
  return {
    name: "openai",
    model: config.model,
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
        signal: AbortSignal.timeout(config.timeoutMs),
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

function createAnthropicAdapter(config: { apiKey: string; model: string; timeoutMs: number }): ILLMProvider {
  if (!config.apiKey) throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider");
  return {
    name: "anthropic",
    model: config.model,
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
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
        signal: AbortSignal.timeout(config.timeoutMs),
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
