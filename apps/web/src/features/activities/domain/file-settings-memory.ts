import type { FileSettings } from "./activity-evidence";

/** The minimal storage this needs, so a test (or a private window with no storage at all) can stand in for `localStorage`. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What is worth remembering between uploads: how sensitive this person's files usually are. Type and indicator differ per file. */
export type RememberedFileSettings = Partial<Pick<FileSettings, "confidentialityLevel">>;

export interface FileSettingsMemory {
  load(): RememberedFileSettings;
  save(settings: RememberedFileSettings): void;
}

const KEY = "donordesk.fileSettings.v1";
const LEVELS: ReadonlyArray<FileSettings["confidentialityLevel"]> = ["PUBLIC", "INTERNAL", "SENSITIVE", "HIGHLY_SENSITIVE"];

/** Never throws: storage can be missing, full or blocked, and a failed read or write simply remembers nothing. */
export function createFileSettingsMemory(store: KeyValueStore | null): FileSettingsMemory {
  return {
    load() {
      try {
        const raw = store?.getItem(KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        const level = (parsed as { confidentialityLevel?: unknown } | null)?.confidentialityLevel;
        return LEVELS.includes(level as FileSettings["confidentialityLevel"]) ? { confidentialityLevel: level as FileSettings["confidentialityLevel"] } : {};
      } catch {
        return {};
      }
    },
    save(settings) {
      try {
        store?.setItem(KEY, JSON.stringify(settings));
      } catch {
        /* nothing to remember with */
      }
    },
  };
}
