import { DomainError, formKitById, type FormKit, type Result } from "@donordesk/domain";
import type { ApplyKitInput, SaveCollectionFormInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import { can, fail, ok } from "./assessment-common.js";
import type { SaveCollectionFormHandler } from "./collection-handlers.js";

/**
 * A ready-made form (Phase 62.10) saved as a DRAFT through the ordinary save, so every form rule applies and nothing is published. The
 * person reviews and edits it like any form. What the kit leaves out and the indicators it suggests are returned, never created.
 */
export class ApplyFormKitHandler {
  constructor(private readonly save: Pick<SaveCollectionFormHandler, "handle">) {}

  async handle(ctx: AuthenticatedContext, input: ApplyKitInput): Promise<Result<{ id: string; notes: readonly string[]; suggestedIndicators: FormKit["suggestedIndicators"]; unreviewed: true }, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot design forms"));
    const kit = formKitById(input.kitId);
    if (!kit) return fail(DomainError.notFound("Kit", input.kitId));
    const def = kit.build();
    const saved = await this.save.handle(ctx, {
      projectId: input.projectId, name: input.name ?? kit.name, description: kit.description, fields: def.fields as never, mappings: [],
      ...(def.constraints ? { constraints: def.constraints as never } : {}), ...(def.subject ? { subject: def.subject } : {}), ...(def.score ? { score: def.score as never } : {}),
    } as SaveCollectionFormInput);
    if (!saved.ok) return saved;
    return ok({ id: saved.value.id, notes: kit.notes, suggestedIndicators: kit.suggestedIndicators, unreviewed: true });
  }
}
