/**
 * The single-read path (`SETUP_READ_MODE=single`): one model call reads the whole document and every area takes its part.
 * The orchestrator still runs each area through the same grounding, review and save, so only the reading changed.
 *
 * One reading per run: the orchestrator hands every area the same `blocks` array, so the reading is memoised on that array
 * (a WeakMap, so it is released with the run). The first area to ask makes the call and carries its usage; the rest wait
 * for the same answer. A rerun of one area reads the document again, because it is given a new array.
 */
import { DomainError, SINGLE_READ_VERSION, err, ok, singleReadFields, tryParseJson, type Result, type SetupAreaKey, type SourceBlock } from "@donordesk/domain";
import type { ExtractedArea, ISetupAreaExtractor, ISetupLlm, SetupExtractInput, SetupUsage } from "@donordesk/application";
import { SINGLE_READ_SYSTEM, singleReadUser } from "./prompts/single-read.js";

export interface SingleReading {
  fields: Record<SetupAreaKey, Record<string, unknown>>;
  model?: string | undefined;
  /** The area whose call made this reading; only it reports the usage, so the cost is counted once. */
  billedTo: SetupAreaKey;
  usage?: SetupUsage | undefined;
}

const readings = new WeakMap<ReadonlyArray<SourceBlock>, Promise<Result<SingleReading, DomainError>>>();

export class SingleReadReader {
  constructor(private readonly llm: ISetupLlm) {}

  read(area: SetupAreaKey, input: SetupExtractInput): Promise<Result<SingleReading, DomainError>> {
    const known = readings.get(input.blocks);
    if (known) return known;
    const reading = this.call(area, input);
    readings.set(input.blocks, reading);
    return reading;
  }

  private async call(area: SetupAreaKey, input: SetupExtractInput): Promise<Result<SingleReading, DomainError>> {
    const reply = await this.llm.completeJson({
      tenantId: input.tenantId, system: SINGLE_READ_SYSTEM, user: singleReadUser(input.sourceText),
      maxTokens: input.maxTokens, timeoutMs: input.timeoutMs,
    });
    if (!reply.ok) return reply;
    if (reply.value === null) return err(new DomainError("POLICY_DENIED", "The AI service is not available for this organisation right now."));
    if (reply.value.truncated) return err(new DomainError("VALIDATION_FAILED", "The answer was cut off at the token limit."));
    const parsed = tryParseJson(reply.value.text);
    if (parsed === undefined) return err(new DomainError("VALIDATION_FAILED", "The model did not answer with readable JSON for this document."));
    const usage = reply.value.usage ? { calls: 1, inputTokens: reply.value.usage.inputTokens, outputTokens: reply.value.usage.outputTokens } : undefined;
    return ok({ fields: singleReadFields(parsed), model: reply.value.model, billedTo: area, usage });
  }
}

/** One area of the single read: the orchestrator sees the same interface as the per-area extractors. */
export class SingleReadAreaExtractor implements ISetupAreaExtractor {
  constructor(readonly area: SetupAreaKey, private readonly reader: SingleReadReader) {}

  async extract(input: SetupExtractInput): Promise<Result<ExtractedArea, DomainError>> {
    // A focused second look (the repair step) is not part of a whole-document reading: nothing new to ask for.
    if (input.hint) return ok({ fields: {} });
    const reading = await this.reader.read(this.area, input);
    if (!reading.ok) return reading;
    const mine = reading.value.billedTo === this.area;
    return ok({
      fields: reading.value.fields[this.area],
      promptVersion: SINGLE_READ_VERSION,
      ...(reading.value.model ? { model: reading.value.model } : {}),
      ...(mine && reading.value.usage ? { usage: reading.value.usage } : {}),
    });
  }
}
