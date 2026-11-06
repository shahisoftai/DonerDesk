import { DomainError, type Responsibility, type ResponsibilityKind } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../../context.js";
import type { SetupIndicatorOwners } from "../../../ports/project-setup-launch.js";

/** Writes one kind of responsibility for a person who is on the project, through the one handler that owns it. */
export interface IResponsibilityApplier<K extends ResponsibilityKind = ResponsibilityKind> {
  readonly kind: K;
  apply(ctx: AuthenticatedContext, projectId: string, userId: string, responsibility: Extract<Responsibility, { kind: K }>): ReturnType<SetupIndicatorOwners["setOwner"]>;
}

/** The indicator the person owns, looked up by its code in this project. */
export class IndicatorOwnerApplier implements IResponsibilityApplier<"INDICATOR_OWNER"> {
  readonly kind = "INDICATOR_OWNER" as const;
  constructor(private readonly owners: SetupIndicatorOwners) {}
  async apply(ctx: AuthenticatedContext, projectId: string, userId: string, r: Extract<Responsibility, { kind: "INDICATOR_OWNER" }>) {
    const ids = await this.owners.idsByCode(ctx, projectId);
    if (!ids.ok) return ids;
    const id = ids.value.get(r.indicatorCode);
    if (!id) return { ok: false as const, error: DomainError.notFound("Indicator", r.indicatorCode) };
    return this.owners.setOwner(ctx, id, userId);
  }
}

/** Applies each responsibility with the applier for its kind; what cannot be done comes back as sentences, never as a stop. */
export async function applyResponsibilities(
  appliers: ReadonlyArray<IResponsibilityApplier>, ctx: AuthenticatedContext, projectId: string, userId: string, list: readonly Responsibility[],
): Promise<{ done: number; failed: Array<{ responsibility: Responsibility; reason: string }> }> {
  const byKind = new Map(appliers.map((a) => [a.kind, a] as const));
  let done = 0;
  const failed: Array<{ responsibility: Responsibility; reason: string }> = [];
  for (const r of list) {
    const applier = byKind.get(r.kind);
    if (!applier) { failed.push({ responsibility: r, reason: "This kind of responsibility cannot be set yet." }); continue; }
    const outcome = await (applier as IResponsibilityApplier).apply(ctx, projectId, userId, r as never);
    if (outcome.ok) done += 1;
    else failed.push({ responsibility: r, reason: outcome.error.message });
  }
  return { done, failed };
}
