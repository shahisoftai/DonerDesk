/**
 * What an AI call costs. Plan limits bound how much people may draft, never what the provider charges; cost was
 * hard-coded to 0 at every ledger write, so a runaway loop or a price change was invisible.
 *
 * Prices are US dollars per million tokens. The built-in table is an **estimate** of the provider's list price on the
 * date given, not a bill: set `LLM_PRICES_JSON` (see `pricesFromEnv`) to the rates you actually pay. A model with no
 * price is costed at 0 and reported as unpriced (`isPriced`), so a missing entry shows up as a gap, not as "free".
 */
export interface LlmPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

export type LlmPriceTable = Readonly<Record<string, LlmPrice>>;

/** Self-hosted models cost the provider nothing per call. */
const FREE_MODEL_PREFIXES = ["ollama:", "ollama/", "llama", "stub", "deterministic"];

/** List-price estimate, checked 2026-10-20 against third-party summaries of the provider's pricing page (rates differ between sources). */
export const DEFAULT_LLM_PRICES: LlmPriceTable = {
  "glm-5.3-flash": { inputPerMTok: 0.15, outputPerMTok: 0.5 },
};

let overrides: LlmPriceTable = {};

/** Sets the operator's own rates (from the environment), merged over the defaults. */
export function configureLlmPrices(table: LlmPriceTable): void {
  overrides = table;
}

/** Parses `LLM_PRICES_JSON` = `{"model-id":{"inputPerMTok":0.15,"outputPerMTok":0.5}}`; ignores anything malformed. */
export function pricesFromEnv(raw: string | undefined): LlmPriceTable {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<LlmPrice>>;
    const out: Record<string, LlmPrice> = {};
    for (const [model, p] of Object.entries(parsed)) {
      if (p && Number.isFinite(p.inputPerMTok) && Number.isFinite(p.outputPerMTok) && (p.inputPerMTok as number) >= 0 && (p.outputPerMTok as number) >= 0) {
        out[model.toLowerCase()] = { inputPerMTok: p.inputPerMTok as number, outputPerMTok: p.outputPerMTok as number };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function priceOf(model: string, table: LlmPriceTable): LlmPrice | null {
  const id = model.toLowerCase();
  if (FREE_MODEL_PREFIXES.some((p) => id.startsWith(p))) return { inputPerMTok: 0, outputPerMTok: 0 };
  const merged = { ...DEFAULT_LLM_PRICES, ...overrides, ...table };
  if (merged[id]) return merged[id] ?? null;
  // The longest listed id that prefixes the model (a dated snapshot of a listed model).
  const match = Object.keys(merged).filter((k) => id.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return match ? (merged[match] ?? null) : null;
}

export function isPriced(model: string, table: LlmPriceTable = {}): boolean {
  return priceOf(model, table) !== null;
}

/** Dollars for a call, rounded to a millionth of a dollar; 0 for an unpriced model (check `isPriced`). */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number, table: LlmPriceTable = {}): number {
  const price = priceOf(model, table);
  if (!price) return 0;
  const cost = (Math.max(0, inputTokens) * price.inputPerMTok + Math.max(0, outputTokens) * price.outputPerMTok) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}

/**
 * The model a call is priced by. The AI Reporter is one pipeline name ("ai-reporter") over a provider's model, which it records
 * as "provider/model" in the version, so a call named after the pipeline is priced by the model underneath. Without this every
 * section the AI Reporter wrote was costed at 0 and the month's estimate read "none recorded".
 */
export function pricedModelId(modelId: string, modelVersion?: string, table: LlmPriceTable = {}): string {
  if (isPriced(modelId, table) || !modelVersion) return modelId;
  const underlying = modelVersion.includes("/") ? modelVersion.slice(modelVersion.indexOf("/") + 1) : modelVersion;
  return isPriced(underlying, table) ? underlying : modelId;
}
