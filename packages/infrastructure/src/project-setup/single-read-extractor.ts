/**
 * One area of the single read (`SETUP_READ_MODE=single`): the area's part of the one whole-document reading that `SingleReadReader` makes,
 * behind the same interface as the per-area extractors, so the orchestrator's grounding, review and save are unchanged.
 */
import { SINGLE_READ_VERSION, ok, type DomainError, type Result, type SetupAreaKey } from "@donordesk/domain";
import type { ExtractedArea, ISetupAreaExtractor, SetupExtractInput } from "@donordesk/application";
import type { SingleReadReader } from "./single-read-reader.js";

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
