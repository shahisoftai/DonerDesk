import type { ILLMProvider, LLMCompletionInput } from "@donordesk/application";

export interface OpenAIAdapterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export function createOpenAIAdapter(config: OpenAIAdapterConfig): ILLMProvider {
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
            ...(input.systemPrompt
              ? [{ role: "system" as const, content: input.systemPrompt }]
              : []),
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
