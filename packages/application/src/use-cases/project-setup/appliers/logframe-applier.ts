import { logframeSheet, ok, type DomainError, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";
import type { SetupLogframeImporter } from "../../../ports/project-setup-apply.js";

/** Accepted logframe items through the ordinary logframe import (codes already in the project are skipped there). */
export class LogframeApplier implements ISetupAreaApplier {
  readonly area = "LOGFRAME" as const;
  constructor(private readonly importer: SetupLogframeImporter) {}
  async dryRun(_ctx: SetupApplyContext, p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    const s = logframeSheet(p);
    return ok({ items: s.rows, notes: s.notes });
  }
  async apply(ctx: SetupApplyContext, projectId: string, p: ProjectSetupProposal): Promise<Result<SetupApplyOutcome, DomainError>> {
    const s = logframeSheet(p);
    if (s.rows === 0) return ok({ created: 0, skipped: 0, notes: s.notes });
    const r = await this.importer.handle(ctx.auth, { projectId, text: s.text, sourceName: "Project document" });
    return r.ok ? ok({ created: r.value.created, skipped: r.value.skipped, notes: [...s.notes, ...r.value.warnings] }) : r;
  }
}
