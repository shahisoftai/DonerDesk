import type { DomainError, Result } from "@donordesk/domain";
import type { IClock } from "../../ports/core.js";
import type { ISetupRunRepository, StoredSetupProposal } from "../../ports/project-setup.js";
import { describeDraft, type SetupDraftView } from "./draft-view.js";

/** Builds the draft's view with the readings the draft has had, so every answer the wizard gets back says what was left out and which parts are being read again. */
export class DraftViewer {
  constructor(private readonly runs: ISetupRunRepository, private readonly clock: IClock) {}

  async describe(stored: StoredSetupProposal): Promise<Result<SetupDraftView, DomainError>> {
    const runs = await this.runs.listByProposal(stored.id, stored.tenantId);
    if (!runs.ok) return runs;
    return { ok: true, value: describeDraft(stored, { runs: runs.value, now: this.clock.now() }) };
  }
}
