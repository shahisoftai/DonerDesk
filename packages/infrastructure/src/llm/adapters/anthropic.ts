import type { ILLMProvider, LLMCompletionInput } from "@donordesk/application";

export interface AnthropicAdapterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export function createAnthropicAdapter(config: AnthropicAdapterConfig): ILLMProvider {
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
