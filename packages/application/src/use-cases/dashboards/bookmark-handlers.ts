import { DomainError, checkBookmark, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IBookmarkRepository, StoredBookmark } from "../../ports/dashboards.js";

/** A person's own bookmarks (Phase 34.7). Always the caller's: no handler takes a user id. */
export interface BookmarkDto { id: string; title: string; href: string }
const dto = (b: StoredBookmark): BookmarkDto => ({ id: b.id, title: b.title, href: b.href });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });

export class ListBookmarksHandler {
  constructor(private readonly repo: IBookmarkRepository) {}
  async handle(ctx: AuthenticatedContext): Promise<Result<{ bookmarks: BookmarkDto[] }, DomainError>> {
    const r = await this.repo.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    return r.ok ? ok({ bookmarks: r.value.map(dto) }) : r;
  }
}

export class AddBookmarkHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IBookmarkRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, input: { title: string; href: string }): Promise<Result<BookmarkDto, DomainError>> {
    const mine = await this.repo.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    if (!mine.ok) return mine;
    const checked = checkBookmark(input, mine.value.map((b) => b.href));
    if (!checked.ok) return { ok: false, error: DomainError.validation(checked.problem.message) };
    const b: StoredBookmark = { id: this.ids.generate(), tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId, ...checked.value, createdAt: this.clock.now() };
    const saved = await this.repo.create(b);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "bookmark.added", entityType: "bookmark", entityId: b.id });
    return ok(dto(b));
  }
}

export class RemoveBookmarkHandler {
  constructor(private readonly repo: IBookmarkRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    const r = await this.repo.delete(id, ctx.tenant.tenantId, ctx.tenant.userId);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "bookmark.removed", entityType: "bookmark", entityId: id });
    return ok(undefined);
  }
}
