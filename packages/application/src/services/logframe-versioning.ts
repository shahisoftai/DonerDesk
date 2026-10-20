import type { Result, TenantId } from "@donordesk/domain";
import {
  DomainError,
  buildLogframeSnapshot,
  canonicalSnapshotJson,
  diffLogframeSnapshots,
  parseSnapshot,
  summarizeLogframeChanges,
  type LogframeSnapshot,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IHashService, IIdGenerator } from "../ports/core.js";
import type { IIndicatorRepository, ILogframeRepository, ILogframeVersionRepository, LogframeVersionRecord } from "../ports/logframe.js";

/**
 * Writes a version of a project's results framework after it changes. Append-only: each version is the whole framework
 * (items and indicator definitions, targets included) at that moment, so a figure that moved or a report approved
 * against an earlier framework can be explained. A save that changes nothing writes nothing.
 */
export class LogframeVersioner {
  constructor(
    private readonly items: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly versions: ILogframeVersionRepository,
    private readonly hash: IHashService,
    private readonly ids: IIdGenerator,
  ) {}

  async current(projectId: string, tenantId: TenantId): Promise<Result<{ snapshot: LogframeSnapshot; json: string; hash: string }, DomainError>> {
    const items = await this.items.findByProject(projectId, tenantId);
    if (!items.ok) return items;
    const indicators = await this.indicators.findByProject(projectId, tenantId, { includeArchived: true });
    if (!indicators.ok) return indicators;
    const snapshot = buildLogframeSnapshot(items.value, indicators.value);
    const json = canonicalSnapshotJson(snapshot);
    return { ok: true, value: { snapshot, json, hash: this.hash.sha256Hex(json) } };
  }

  /** Records the framework as it is now; returns the new version, or null when nothing changed since the last one. */
  async capture(ctx: AuthenticatedContext, projectId: string, reason?: string): Promise<Result<LogframeVersionRecord | null, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const now = await this.current(projectId, tenantId);
    if (!now.ok) return now;
    const latest = await this.versions.latest(projectId, tenantId);
    if (!latest.ok) return latest;
    if (latest.value && latest.value.contentHash === now.value.hash) return { ok: true, value: null };
    // A framework with nothing in it yet has no history worth keeping.
    if (!latest.value && now.value.snapshot.items.length === 0 && now.value.snapshot.indicators.length === 0) return { ok: true, value: null };

    const before = latest.value ? parseSnapshot(latest.value.snapshotJson) : null;
    const summary = reason ?? summarizeLogframeChanges(diffLogframeSnapshots(before, now.value.snapshot));
    const record: LogframeVersionRecord = {
      id: this.ids.generate(),
      tenantId: tenantId.toString(),
      projectId,
      version: (latest.value?.version ?? 0) + 1,
      snapshotJson: now.value.json,
      contentHash: now.value.hash,
      summary,
      createdById: ctx.tenant.userId,
      createdAt: new Date(),
    };
    const saved = await this.versions.create(record);
    if (!saved.ok) return saved;
    return { ok: true, value: record };
  }
}

type Handle = (...args: never[]) => Promise<Result<unknown, DomainError>>;

/**
 * Wraps a use case that changes the framework so a version is written after it succeeds. `projectOf` finds the project
 * from the call's arguments *before* the call (a delete removes the record it would be found by). Versioning never fails
 * the change that triggered it: a failure is passed to `onError` and the change stands.
 */
export function withLogframeVersioning<H extends { handle: Handle }>(
  handler: H,
  versioner: LogframeVersioner,
  options: { projectOf: (args: unknown[]) => Promise<string | undefined> | string | undefined; onError?: (error: unknown) => void },
): H {
  const original = handler.handle.bind(handler) as (...args: unknown[]) => Promise<Result<unknown, DomainError>>;
  (handler as { handle: unknown }).handle = async (...args: unknown[]) => {
    let projectId: string | undefined;
    try {
      projectId = await options.projectOf(args);
    } catch (error) {
      options.onError?.(error);
    }
    const result = await original(...args);
    if (result.ok && projectId) {
      try {
        const captured = await versioner.capture(args[0] as AuthenticatedContext, projectId);
        if (!captured.ok) options.onError?.(captured.error);
      } catch (error) {
        options.onError?.(error);
      }
    }
    return result;
  };
  return handler;
}
