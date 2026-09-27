import {
  emptyWizardData,
  ProjectWizardGeographySchema,
  ProjectWizardReportingSchema,
  type ProjectWizardData,
} from "../validation/project-wizard.ts";

export interface WizardDraft {
  data: ProjectWizardData;
  stepIndex: number;
  savedAt: number;
}

export interface WizardDraftStore {
  load(): WizardDraft | null;
  save(draft: Omit<WizardDraft, "savedAt">): void;
  clear(): void;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const WIZARD_DRAFT_KEY = "donordesk.project-wizard.draft";
export const WIZARD_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** Rebuilds wizard data from untrusted stored JSON: unknown keys dropped, invalid enums reset to defaults. */
export function parseWizardDraft(raw: unknown, maxStepIndex: number): Omit<WizardDraft, "savedAt"> | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return null;
  const empty = emptyWizardData();
  const pick = <T extends object>(defaults: T, source: unknown): T => {
    const values = strings(source);
    return Object.fromEntries(Object.keys(defaults).map((key) => [key, values[key] ?? defaults[key as keyof T]])) as T;
  };
  const geography = pick(empty.geography, data.geography);
  const reporting = pick(empty.reporting, data.reporting);
  if (!ProjectWizardGeographySchema.shape.sector.safeParse(geography.sector).success) geography.sector = empty.geography.sector;
  if (!ProjectWizardReportingSchema.shape.reportingFrequency.safeParse(reporting.reportingFrequency).success) {
    reporting.reportingFrequency = empty.reporting.reportingFrequency;
  }
  const stepIndex = typeof record.stepIndex === "number" && Number.isInteger(record.stepIndex) ? record.stepIndex : 0;
  return {
    data: { step: pick(empty.step, data.step), geography, reporting },
    stepIndex: Math.max(0, Math.min(stepIndex, maxStepIndex)),
  };
}

/** True when the user has typed anything beyond the defaults. */
export function hasWizardInput(data: ProjectWizardData): boolean {
  const empty = emptyWizardData();
  return (["step", "geography", "reporting"] as const).some((section) =>
    Object.entries(data[section]).some(([key, value]) => (value ?? "") !== ((empty[section] as Record<string, string | undefined>)[key] ?? "")),
  );
}

export function createWizardDraftStore(
  storage: KeyValueStorage | null,
  options: { maxStepIndex: number; now?: () => number; key?: string; ttlMs?: number },
): WizardDraftStore {
  const key = options.key ?? WIZARD_DRAFT_KEY;
  const ttl = options.ttlMs ?? WIZARD_DRAFT_TTL_MS;
  const now = options.now ?? Date.now;
  const safely = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    load() {
      if (!storage) return null;
      return safely(() => {
        const text = storage.getItem(key);
        if (!text) return null;
        const raw = JSON.parse(text) as { savedAt?: unknown };
        const savedAt = typeof raw.savedAt === "number" ? raw.savedAt : 0;
        const parsed = parseWizardDraft(raw, options.maxStepIndex);
        if (!parsed || now() - savedAt > ttl || !hasWizardInput(parsed.data)) {
          storage.removeItem(key);
          return null;
        }
        return { ...parsed, savedAt };
      }, null);
    },
    save(draft) {
      if (!storage) return;
      safely(() => storage.setItem(key, JSON.stringify({ ...draft, savedAt: now() })), undefined);
    },
    clear() {
      if (!storage) return;
      safely(() => storage.removeItem(key), undefined);
    },
  };
}
