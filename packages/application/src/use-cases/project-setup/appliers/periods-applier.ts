import { DomainError, ok, willApplyItem, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";
import type { SetupPeriodCreator, SetupWorkspaceProbe } from "../../../ports/project-setup-apply.js";

/** How long the periods wait for a new project's folders before saying so (Phase 37.7). */
export interface WorkspaceWait {
  attempts: number;
  delayMs: number;
  sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_WORKSPACE_WAIT: WorkspaceWait = { attempts: 30, delayMs: 3_000, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

/**
 * Reporting periods come from the project's own cadence and dates (`CreateAllPeriodsHandler`), the one rule for which
 * periods exist; the document's stated cadence chose the project's reporting frequency in the draft. Periods already there
 * are not created again. A new project's folders are made in the background and periods are refused until they exist, so
 * this step waits for them; if they are still not ready it fails with a plain sentence, and "Finish creating" makes the
 * periods later (the steps already done are kept).
 */
export class PeriodsApplier implements ISetupAreaApplier {
  readonly area = "PERIODS" as const;
  constructor(
    private readonly periods: SetupPeriodCreator,
    private readonly workspace?: SetupWorkspaceProbe,
    private readonly wait: WorkspaceWait = DEFAULT_WORKSPACE_WAIT,
  ) {}

  async dryRun(_ctx: SetupApplyContext, p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    return ok({ items: p.periods.filter(willApplyItem).length, notes: ["Reporting periods are created from the project's dates and reporting frequency."] });
  }

  async apply(ctx: SetupApplyContext, projectId: string): Promise<Result<SetupApplyOutcome, DomainError>> {
    if (this.workspace) {
      let preparing = await this.workspace.stillPreparing(ctx.auth, projectId);
      for (let n = 1; preparing && n < this.wait.attempts; n += 1) {
        await this.wait.sleep(this.wait.delayMs);
        preparing = await this.workspace.stillPreparing(ctx.auth, projectId);
      }
      if (preparing) {
        return { ok: false, error: DomainError.validation("The project's folders in your Google Drive are still being prepared, so the reporting periods could not be made yet. Press Finish creating in a minute.") };
      }
    }
    const r = await this.periods.handle(ctx.auth, projectId);
    return r.ok ? ok({ created: r.value.created.length, skipped: 0, notes: r.value.failed.map((f) => f.error) }) : r;
  }
}
