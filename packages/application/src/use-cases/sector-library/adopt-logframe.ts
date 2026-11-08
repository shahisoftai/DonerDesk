import type { CreateLogframeItemInput } from "@donordesk/contracts";
import type { LibraryLevel, LibrarySectorId, Result } from "@donordesk/domain";
import { BUILT_IN_CONTENT, DomainError, LIBRARY_SECTOR_IDS } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ILogframeRepository } from "../../ports/logframe.js";

export interface LogframeItemCreator { handle(ctx: AuthenticatedContext, input: CreateLogframeItemInput): Promise<Result<{ id: string }, DomainError>> }

export interface AdoptSkeletonInput { projectId: string; sectorId: string; /** Only these nodes (and the ones above them). Omitted: the whole skeleton. */ nodeKeys?: readonly string[] | undefined }
export interface AdoptSkeletonResult { created: Array<{ key: string; id: string; title: string }>; reused: Array<{ key: string; id: string; title: string }>; skipped: Array<{ key: string; reason: string }> }

/**
 * Adds a sector's suggested results (goal, outcomes, outputs) to a project. A result the project already has at the same level with
 * the same title is reused, not made twice; a second goal is never added. Through the ordinary logframe handler.
 */
export class AdoptLibraryLogframeHandler {
  constructor(private readonly logframe: ILogframeRepository, private readonly creator: LogframeItemCreator, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: AdoptSkeletonInput): Promise<Result<AdoptSkeletonResult, DomainError>> {
    if (!(LIBRARY_SECTOR_IDS as readonly string[]).includes(input.sectorId)) return { ok: false, error: DomainError.notFound("Sector", input.sectorId) };
    const skeleton = BUILT_IN_CONTENT[input.sectorId as LibrarySectorId].logframe;
    if (skeleton.length === 0) return { ok: false, error: DomainError.validation("This sector has no suggested results.") };
    const existing = await this.logframe.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const wanted = new Set(input.nodeKeys ?? skeleton.map((n) => n.key));
    // A chosen node brings the ones above it, so nothing is left without a parent.
    const byKey = new Map(skeleton.map((n) => [n.key, n] as const));
    for (const key of [...wanted]) for (let p = byKey.get(key)?.parent; p; p = byKey.get(p)?.parent) wanted.add(p);
    const idByKey = new Map<string, string>();
    const out: AdoptSkeletonResult = { created: [], reused: [], skipped: [] };
    const same = (level: LibraryLevel, title: string) => existing.value.find((i) => i.level === level && i.title.trim().toLowerCase() === title.trim().toLowerCase());
    for (const node of skeleton) {
      if (!wanted.has(node.key)) continue;
      const found = same(node.level, node.title);
      if (found) { idByKey.set(node.key, found.id); out.reused.push({ key: node.key, id: found.id, title: node.title }); continue; }
      if (node.level === "GOAL" && existing.value.some((i) => i.level === "GOAL")) {
        const goal = existing.value.find((i) => i.level === "GOAL")!;
        idByKey.set(node.key, goal.id);
        out.skipped.push({ key: node.key, reason: "The project already has a goal." });
        continue;
      }
      const parentId = node.parent ? idByKey.get(node.parent) : undefined;
      if (node.parent && !parentId) { out.skipped.push({ key: node.key, reason: "Its parent was not added." }); continue; }
      const made = await this.creator.handle(ctx, { projectId: input.projectId, level: node.level, title: node.title, ...(parentId ? { parentId } : {}) });
      if (!made.ok) { out.skipped.push({ key: node.key, reason: made.error.message }); continue; }
      idByKey.set(node.key, made.value.id);
      out.created.push({ key: node.key, id: made.value.id, title: node.title });
    }
    if (out.created.length > 0) {
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "sector_library.skeleton_adopted", entityType: "project", entityId: input.projectId, projectId: input.projectId, newValue: `${out.created.length} results from the ${input.sectorId} pack` });
    }
    return { ok: true, value: out };
  }
}
