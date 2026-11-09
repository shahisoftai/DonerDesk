import type { DataVersion } from "@donordesk/domain";

/**
 * The per-project version of each data source (Phase 48.17). It goes up when something that feeds a source changes; an open canvas
 * asks for it cheaply and redraws only what changed. The first adapter lives in memory (one api process): a restart changes the
 * `epoch`, which every client reads as "ask for everything once".
 */
export interface IDataVersions {
  /** The versions of one project's sources, with the process epoch. */
  read(tenantId: string, projectId: string): Promise<{ epoch: string; versions: DataVersion }>;
  bump(tenantId: string, projectId: string, sources: readonly string[]): Promise<void>;
}
