/**
 * What the Record sheet remembers on this device: the project and the kind used last, so the next record starts two taps in.
 * Read defensively: stored text can be old, edited or from another version, and a bad value is simply "nothing remembered".
 */
import type { RecordKindKey } from "./record-kinds.ts";

export interface RecordPrefs {
  projectId?: string;
  kind?: RecordKindKey;
}

const KINDS: readonly RecordKindKey[] = ["NUMBER", "ACTIVITY", "FILE", "EXPENSE", "FORM"];
export const RECORD_PREFS_KEY = "donordesk-record-prefs";

export function parseRecordPrefs(text: string | null | undefined): RecordPrefs {
  if (!text) return {};
  try {
    const raw = JSON.parse(text) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return {};
    const projectId = typeof raw.projectId === "string" && raw.projectId.length > 0 && raw.projectId.length <= 80 ? raw.projectId : undefined;
    const kind = KINDS.find((k) => k === raw.kind);
    return { ...(projectId ? { projectId } : {}), ...(kind ? { kind } : {}) };
  } catch {
    return {};
  }
}

export function serializeRecordPrefs(prefs: RecordPrefs): string {
  return JSON.stringify({ ...(prefs.projectId ? { projectId: prefs.projectId } : {}), ...(prefs.kind ? { kind: prefs.kind } : {}) });
}

/** The project to open: the remembered one when the person still has it, else the only one, else none (they choose). */
export function startingProject(projects: ReadonlyArray<{ id: string }>, remembered?: string): string | undefined {
  if (remembered && projects.some((p) => p.id === remembered)) return remembered;
  return projects.length === 1 ? projects[0]!.id : undefined;
}
