import type { ILLMProvider, LLMCompletionInput } from "@donordesk/application";

export interface DeepSeekAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export function createDeepSeekAdapter(config: DeepSeekAdapterConfig): ILLMProvider {
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
