import type { ILLMProvider, LLMCompletionInput } from "@donordesk/application";
import { OllamaProvider } from "../../ai/ollama.js";

export interface OllamaAdapterConfig {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export function createOllamaAdapter(config: OllamaAdapterConfig): ILLMProvider {
  const provider = new OllamaProvider({
    baseUrl: config.baseUrl ?? "http://localhost:11434",
    model: config.model ?? "llama3.2",
    timeoutMs: config.timeoutMs ?? 60000,
  });
  return {
    name: "ollama",
    model: config.model ?? "llama3.2",
    promptVersion: "1.0.0",
    async complete(input: LLMCompletionInput) {
      const fullPrompt = input.systemPrompt
        ? `${input.systemPrompt}\n\n${input.userPrompt}`
        : input.userPrompt;
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
