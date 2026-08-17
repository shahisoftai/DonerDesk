import type { ILLMProvider, LLMCompletionInput } from "@donordesk/application";

export interface MiniMaxAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  groupId?: string;
  timeoutMs?: number;
}

export function createMiniMaxAdapter(config: MiniMaxAdapterConfig): ILLMProvider {
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
