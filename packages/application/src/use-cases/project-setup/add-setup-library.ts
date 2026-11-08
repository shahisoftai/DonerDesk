import type { LibraryIndicator, ResultOperation, Result } from "@donordesk/domain";
import { BUILT_IN_CONTENT, DomainError, LIBRARY_SECTOR_IDS, type LibrarySectorId } from "@donordesk/domain";
import type { SetupLibraryOperationInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { EffectiveLibraryService } from "../../services/effective-library.js";
import type { SetupDraftView } from "./draft-view.js";

/** The one existing handler that applies a results edit to the proposal; the library adds no writer of its own. */
export interface SetupResultsChanger { handle(ctx: AuthenticatedContext, id: string, op: ResultOperation): Promise<Result<SetupDraftView, DomainError>> }

/**
 * Choosing from the sector library on a wizard slide. The request names entries by id; this resolves them (the organisation's own
 * wording included, hidden ones excluded) into the domain's edit and hands it to the ordinary results handler, so the same checks,
 * version rule and audit apply as for any other edit.
 */
export class AddSetupLibraryHandler {
  constructor(private readonly library: EffectiveLibraryService, private readonly results: SetupResultsChanger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, id: string, input: SetupLibraryOperationInput): Promise<Result<SetupDraftView, DomainError>> {
    if (input.kind === "ADD_FROM_SKELETON") {
      if (!(LIBRARY_SECTOR_IDS as readonly string[]).includes(input.sectorId)) return { ok: false, error: DomainError.notFound("Sector", input.sectorId) };
      const sectorId = input.sectorId as LibrarySectorId;
      return this.results.handle(ctx, id, { kind: "ADD_FROM_SKELETON", sectorId, skeleton: BUILT_IN_CONTENT[sectorId].logframe, ...(input.nodeKeys ? { nodeKeys: input.nodeKeys } : {}) });
    }
    const lib = await this.library.forTenant(ctx.tenant.tenantId);
    if (!lib.ok) return lib;
    const entries: LibraryIndicator[] = [...new Set(input.ids)].flatMap((i) => { const e = lib.value.byId.get(i); return e ? [e] : []; });
    if (entries.length === 0) return { ok: false, error: DomainError.validation("Those indicators are not in the library.") };
    return this.results.handle(ctx, id, { kind: "ADD_FROM_LIBRARY", entries, logframeCode: input.logframeCode ?? null, today: this.clock.now().toISOString().slice(0, 10) });
  }
}
