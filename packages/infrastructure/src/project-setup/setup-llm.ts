import { DomainError, err, ok, type TenantId, type Result } from "@donordesk/domain";
import type { ILLMProvider } from "@donordesk/application";
import type { ISetupLlm, SetupLlmCompletion } from "@donordesk/application";

/**
 * The narrow LLM facade the setup extractors see (Phase 36): tenant resolution, JSON mode and the timeout live here, so no
 * extractor touches a provider. A stub provider or an unavailable one answers `null` — the feature is unavailable, never
 * faked.
 */
export class TenantSetupLlm implements ISetupLlm {
  /** `onProviderError` receives the provider's own words (server logs only); the person is shown a plain sentence. */
  constructor(
    private readonly llmFor: (tenantId: string) => Promise<ILLMProvider | null>,
    private readonly onProviderError?: (info: { tenantId: string; message: string }) => void,
  ) {}

  async available(tenantId: TenantId): Promise<boolean> {
    return (await this.llmFor(tenantId.toString())) !== null;
  }

  async completeJson(input: { tenantId: TenantId; system: string; user: string; maxTokens: number; timeoutMs: number }): Promise<Result<SetupLlmCompletion | null, DomainError>> {
    let provider: ILLMProvider | null;
    try {
      provider = await this.llmFor(input.tenantId.toString());
    } catch (e) {
      return err(new DomainError("POLICY_DENIED", e instanceof Error ? e.message : String(e)));
    }
    if (!provider) return ok(null);
    try {
      const reply = await provider.complete({
        systemPrompt: input.system,
        userPrompt: input.user,
        jsonMode: true,
        maxTokens: input.maxTokens,
        temperature: 0,
        timeoutMs: input.timeoutMs,
      });
      return ok({ text: reply.text, model: provider.model, promptVersion: provider.promptVersion, ...(reply.usage ? { usage: { inputTokens: reply.usage.inputTokens, outputTokens: reply.usage.outputTokens } } : {}) });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      this.onProviderError?.({ tenantId: input.tenantId.toString(), message: raw });
      return err(plainProviderError(raw));
    }
  }
}

/**
 * What a person is told when the AI service refuses: one plain sentence and the status code for support, never the provider's
 * own text. A rate limit has its own code so the run stops asking instead of repeating the request for every area.
 */
export function plainProviderError(raw: string): DomainError {
  const status = /\b(4\d\d|5\d\d)\b/.exec(raw)?.[1];
  const code = status ? ` (error ${status})` : "";
  // A rate limit and a used-up quota or credit balance are the same to the person: the service will not answer until
  // something changes, so the run stops asking.
  if (status === "429" || /credit balance is too low|insufficient (balance|credit|funds)|limit exhausted|quota/i.test(raw)) {
    return new DomainError("RATE_LIMITED", `The AI service cannot be used right now: it is busy, or its usage limit or credit has run out${code}. Wait a few minutes and try again. If it keeps happening, an administrator should check the AI provider's billing or quota.`);
  }
  if (status === "401" || status === "403") {
    return new DomainError("POLICY_DENIED", `The AI service did not accept this organisation's key${code}. An administrator should check the AI settings.`);
  }
  return new DomainError("BILLING_PROVIDER_UNAVAILABLE", `The AI service did not answer${code}. Try again in a few minutes.`);
}
