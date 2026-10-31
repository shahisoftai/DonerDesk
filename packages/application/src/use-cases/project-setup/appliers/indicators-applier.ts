import { indicatorSheet, ok, type DomainError, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";
import type { SetupIndicatorImporter } from "../../../ports/project-setup-apply.js";

/** Accepted indicators through the ordinary indicator import (each attached by its logframe code; existing codes skipped). */
export class IndicatorsApplier implements ISetupAreaApplier {
  readonly area = "INDICATORS" as const;
  constructor(private readonly importer: SetupIndicatorImporter) {}
  async dryRun(_ctx: SetupApplyContext, p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    const s = indicatorSheet(p);
    return ok({ items: s.rows, notes: s.notes });
  }
  async apply(ctx: SetupApplyContext, projectId: string, p: ProjectSetupProposal): Promise<Result<SetupApplyOutcome, DomainError>> {
    const s = indicatorSheet(p);
    if (s.rows === 0) return ok({ created: 0, skipped: 0, notes: s.notes });
    const r = await this.importer.handle(ctx.auth, { projectId, text: s.text, sourceName: "Project document" });
    return r.ok ? ok({ created: r.value.created, skipped: r.value.skipped, notes: [...s.notes, ...r.value.warnings] }) : r;
  }
}
