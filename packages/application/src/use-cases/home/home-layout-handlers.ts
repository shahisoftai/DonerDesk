import { DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IHomeLayoutRepository } from "../../ports/home-layout.js";

/** A person's arrangement of Home: positions and flags, never data. Always the caller's own: no handler takes a user id. */
export interface HomeLayoutEntry { key: string; span: 4 | 6 | 8 | 12; hidden: boolean }
export interface HomeLayoutDto { layout: HomeLayoutEntry[] | null; updatedAt: string | null }
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });

/** What is saved is read defensively: a row that no longer parses is "no saved layout" (the default shows), never an error page. */
function parseStored(json: string): HomeLayoutEntry[] | null {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? (v as HomeLayoutEntry[]) : null;
  } catch {
    return null;
  }
}

export class GetHomeLayoutHandler {
  constructor(private readonly layouts: IHomeLayoutRepository) {}
  async handle(ctx: AuthenticatedContext, variant: string): Promise<Result<HomeLayoutDto, DomainError>> {
    const r = await this.layouts.find(ctx.tenant.tenantId, ctx.tenant.userId, variant);
    if (!r.ok) return r;
    if (!r.value) return ok({ layout: null, updatedAt: null });
    return ok({ layout: parseStored(r.value.layoutJson), updatedAt: r.value.updatedAt.toISOString() });
  }
}

export class SaveHomeLayoutHandler {
  constructor(private readonly ids: IIdGenerator, private readonly layouts: IHomeLayoutRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, input: { variant: string; layout: HomeLayoutEntry[]; expectedUpdatedAt: string | null }): Promise<Result<{ updatedAt: string }, DomainError>> {
    const { tenantId, userId } = ctx.tenant;
    const saved = await this.layouts.save(
      { id: this.ids.generate(), tenantId, userId, variant: input.variant, layoutJson: JSON.stringify(input.layout) },
      input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : null,
    );
    if (!saved.ok) return saved;
    if (!saved.value) return { ok: false, error: DomainError.conflict("Your Home was arranged somewhere else since you opened it. Nothing was saved. Reload the page to see that version, then make your changes again.") };
    const now = await this.layouts.find(tenantId, userId, input.variant);
    if (!now.ok) return now;
    await this.audit.record({ tenantId, actorId: userId, eventType: "home_layout.saved", entityType: "home_layout", entityId: now.value?.id ?? input.variant, newValue: JSON.stringify({ variant: input.variant, panels: input.layout.length, hidden: input.layout.filter((e) => e.hidden).length }) });
    return ok({ updatedAt: (now.value?.updatedAt ?? this.clock.now()).toISOString() });
  }
}

export class ResetHomeLayoutHandler {
  constructor(private readonly layouts: IHomeLayoutRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, variant: string): Promise<Result<void, DomainError>> {
    const r = await this.layouts.delete(ctx.tenant.tenantId, ctx.tenant.userId, variant);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "home_layout.reset", entityType: "home_layout", entityId: variant });
    return ok(undefined);
  }
}
