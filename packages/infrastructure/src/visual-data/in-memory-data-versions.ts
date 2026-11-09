import { randomUUID } from "node:crypto";
import type { IDataVersions } from "@donordesk/application";
import type { DataVersion } from "@donordesk/domain";
import { bumpVersion } from "@donordesk/domain";

/**
 * Data versions kept in the api process (Phase 48.17). The platform runs one api process, so a map is enough; the `epoch` is new
 * on every start, and a client that sees a different epoch simply asks for everything once. Nothing here is the record of
 * anything: losing it only costs one refresh. Bounded so a long-lived process cannot grow without limit.
 */
export class InMemoryDataVersions implements IDataVersions {
  private readonly epoch = randomUUID();
  private readonly store = new Map<string, DataVersion>();
  constructor(private readonly maxProjects = 5000) {}

  async read(tenantId: string, projectId: string): Promise<{ epoch: string; versions: DataVersion }> {
    return { epoch: this.epoch, versions: this.store.get(`${tenantId}:${projectId}`) ?? {} };
  }

  async bump(tenantId: string, projectId: string, sources: readonly string[]): Promise<void> {
    const key = `${tenantId}:${projectId}`;
    const next = bumpVersion(this.store.get(key) ?? {}, sources);
    this.store.delete(key); // re-insert to keep the most recently changed last
    this.store.set(key, next);
    if (this.store.size > this.maxProjects) this.store.delete(this.store.keys().next().value as string);
  }
}

/** The one instance for the process: the per-request containers all share it. */
export const processDataVersions = new InMemoryDataVersions();
