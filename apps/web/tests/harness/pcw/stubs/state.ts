import { BUILT_IN_PACKS, emptyDraft, type SetupDraft } from "@donordesk/domain";
import { describeDraft } from "../../../../../../packages/application/src/use-cases/project-setup/draft-view";

/** The one draft the page edits. The server's real rules run on it (the domain operations and the application's own view of the draft); only storage is a variable. */
export interface Store { draft: SetupDraft; status: "READY" | "PARTIAL" | "APPLIED"; appliedProjectId: string | null; version: number; calls: Array<{ name: string; input: unknown }>; flags: { failLaunch: boolean; noAi: boolean }; reading: { sources: unknown[]; leftOut: unknown[]; areaRuns: Record<string, string> } }

export const store: Store = { draft: emptyDraft(false), status: "READY", appliedProjectId: null, version: 1, calls: [], flags: { failLaunch: false, noAi: false }, reading: { sources: [], leftOut: [], areaRuns: {} } };
export const packs = BUILT_IN_PACKS;

export const reset = (): void => {
  store.draft = emptyDraft(false); store.status = "READY"; store.appliedProjectId = null; store.version = 1; store.calls = []; store.flags.failLaunch = false; store.flags.noAi = false; store.reading = { sources: [], leftOut: [], areaRuns: {} };
};

export const record = (name: string, input: unknown): void => { store.calls.push({ name, input }); };

/** The draft as the API answers it: dates as text, as they arrive over the wire. */
export function view() {
  const stored = { id: "draft-1", tenantId: "t", createdById: "u1", status: store.status, sourceName: "", sourceStorageKey: "", sourceHash: "", sourceLength: 0, proposal: store.draft.proposal, extras: store.draft.extras, problems: [], appliedProjectId: store.appliedProjectId ?? undefined, createdAt: new Date(0), updatedAt: new Date(store.version * 1000), expiresAt: new Date(2e12) };
  return { ...JSON.parse(JSON.stringify(describeDraft(stored as never))), ...JSON.parse(JSON.stringify(store.reading)) };
}

export const ok = <T,>(value: T) => ({ ok: true as const, value });
export const fail = (message: string) => ({ ok: false as const, error: { kind: "validation" as const, message } });
