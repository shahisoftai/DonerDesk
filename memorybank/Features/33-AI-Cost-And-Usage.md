# Feature 33: AI cost, usage and spend alerts

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit finding H-19). The built-in price is an **estimate** until you set your own (see §4). Builds on [Feature 11](11-AI-Report-Draft-Generator.md) and [Feature 19](19-Tiers-And-Payments.md).

## 1. What a user gets

| In plain words | Where it shows |
|---|---|
| Each AI call's **estimated cost** in US dollars | Settings → AI usage, column **Est. cost** |
| The month's **estimated provider cost**, from the first of the month (UTC) | AI usage page, under the summary |
| An operator alert when an organisation's estimated spend this month passes a threshold (default **$25**) | The journal, as `ai.spend_alert` (error level); no email yet |

Plan limits still bound how much a person may draft. The cost figure is separate: it shows what the provider charges, not what the plan allows.

## 2. Rules that matter

- **Cost is computed at every ledger write** (drafting, section regeneration, template extraction), from input and output tokens and the model's price per million tokens.
- **Unpriced models cost zero and are reported as unpriced**, never silently free. Self-hosted and stub models are free by definition.
- **The operator's own rates win** over the built-in estimate (`LLM_PRICES_JSON`, for example `{"glm-5.3-flash":{"inputPerMTok":0.15,"outputPerMTok":0.5}}`). A dated snapshot of a listed model uses the listed model's price.
- **The alert runs hourly** and reads across organisations (admin connection). A threshold of 0 turns it off (`AI_MONTHLY_COST_ALERT_USD`).

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `contexts/billing/llm-pricing.ts` (prices, `estimateCostUsd`, `pricesFromEnv`); `contexts/reporting/ai-run-summary.ts` (`costUsd` in the run summary) |
| Application | `services/section-generation-service.ts`, `use-cases/billing/list-ai-section-runs.ts` (`monthCostUsd`) |
| Infrastructure | `llm/usage-recording-provider.ts`; `repositories/billing.ts` (`costSince`, `costByTenantSince`); `ai/spend-monitor.ts` (`checkAiSpend`); `container.ts` (prices loaded from the environment) |
| API | `apps/api/src/server.ts` (hourly check); `GET /v1/ai/section-runs` returns `monthCostUsd` |
| Web | `app/(portal)/settings/ai-usage/page.tsx` (cost column and month line) |

## 4. Limits

- **The built-in price for `glm-5.3-flash` is an estimate** ($0.15 input, $0.50 output per million tokens). Third-party sources disagreed by a factor of two. Set `LLM_PRICES_JSON` to the rates on your invoice before relying on the figure.
- The alert is written to the journal only; no e-mail or dashboard yet.
- Cost is not shown per project or per person.
