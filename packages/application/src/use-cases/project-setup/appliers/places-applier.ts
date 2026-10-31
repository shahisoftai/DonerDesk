import { err, DomainError, ok, placesSheet, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";
import type { SetupPlaceImporter } from "../../../ports/project-setup-apply.js";

/** Places through the ordinary places import (the organisation's shared list; places already there are skipped). */
export class PlacesApplier implements ISetupAreaApplier {
  readonly area = "PLACES" as const;
  constructor(private readonly importer: SetupPlaceImporter) {}
  async dryRun(_ctx: SetupApplyContext, p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    const s = placesSheet(p);
    return ok({ items: s.rows, notes: s.notes });
  }
  async apply(ctx: SetupApplyContext, _projectId: string, p: ProjectSetupProposal): Promise<Result<SetupApplyOutcome, DomainError>> {
    const s = placesSheet(p);
    if (s.rows === 0) return ok({ created: 0, skipped: 0, notes: s.notes });
    const r = await this.importer.handle(ctx.auth, { text: s.text, apply: true });
    if (!r.ok) return r;
    if (r.value.problems.length > 0) {
      return err(DomainError.validation(`The places could not be added: ${r.value.problems.map((x) => `row ${x.row}: ${x.message}`).join("; ")}`));
    }
    return ok({ created: r.value.create.length, skipped: r.value.skipped.length, notes: s.notes });
  }
}
