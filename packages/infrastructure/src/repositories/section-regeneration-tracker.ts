import type { ISectionRegenerationTracker } from "@donordesk/application";

/**
 * In-process registry of running single-section regenerations (Report
 * Editor B7). Regeneration runs inside the api process, so this is exact for
 * a single api instance; after a restart nothing is running and sections
 * simply keep their previous text.
 */
export class InMemorySectionRegenerationTracker implements ISectionRegenerationTracker {
  private readonly running = new Set<string>();

  tryStart(sectionId: string): boolean {
    if (this.running.has(sectionId)) return false;
    this.running.add(sectionId);
    return true;
  }

  finish(sectionId: string): void {
    this.running.delete(sectionId);
  }

  runningAmong(sectionIds: readonly string[]): string[] {
    return sectionIds.filter((id) => this.running.has(id));
  }
}
