import { sourcesTouchedBy } from "@donordesk/domain";
import type { IAuditLogger } from "../ports/core.js";
import type { IDataVersions } from "../ports/visual-data.js";

type AuditInput = Parameters<IAuditLogger["record"]>[0];

/**
 * The same audit logger, plus a bump of the data sources the event touches (Phase 48.17). Like the webhook wrapper, it works from
 * the audit trail so no path (a single action, a bulk action, an import) can forget it. Bumping never fails or delays the change.
 */
export function withDataVersioning<T extends IAuditLogger>(audit: T, versions: IDataVersions): T {
  return new Proxy(audit, {
    get(target, prop, receiver) {
      if (prop !== "record") return Reflect.get(target, prop, receiver);
      return async (input: AuditInput): Promise<void> => {
        await target.record(input);
        const sources = sourcesTouchedBy(input.eventType);
        if (sources.length === 0 || !input.projectId) return;
        try { await versions.bump(input.tenantId.toString(), input.projectId, sources); } catch { /* a missed bump only delays a refresh */ }
      };
    },
  });
}
