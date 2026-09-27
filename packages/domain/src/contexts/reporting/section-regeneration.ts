/**
 * Rules for regenerating a single report section (Report Editor B7). Pure so
 * the api handler and its tests share one definition of "allowed".
 */

/** Maximum length of the optional author instruction sent to the writer. */
export const SECTION_INSTRUCTION_MAX_LENGTH = 500;

/** Section regenerations allowed per draft in a rolling hour (not metered). */
export const SECTION_REGENERATIONS_PER_HOUR = 10;

export const SECTION_REGENERATION_WINDOW_MS = 60 * 60 * 1000;

/** `generationParams.kind` marking a single-section regeneration run. */
export const SECTION_REGENERATION_RUN_KIND = "SECTION_REGENERATION";

export type SectionRegenerationBlock =
  | "DRAFT_NOT_EDITABLE"
  | "DRAFT_SUPERSEDED"
  | "GENERATION_IN_PROGRESS"
  | "SECTION_BUSY"
  | "RATE_LIMITED";

export interface SectionRegenerationCheck {
  draftStatus: string;
  draftSuperseded: boolean;
  /** Statuses of every section in the draft (NOT_STARTED = still being written). */
  sectionStatuses: ReadonlyArray<string>;
  sectionAlreadyRegenerating: boolean;
  /** Section regenerations started for this draft within the window. */
  recentRegenerations: number;
}

/** Why a section cannot be regenerated right now, or `null` when it can. */
export function sectionRegenerationBlock(input: SectionRegenerationCheck): SectionRegenerationBlock | null {
  if (input.draftSuperseded) return "DRAFT_SUPERSEDED";
  if (input.draftStatus !== "DRAFT") return "DRAFT_NOT_EDITABLE";
  if (input.sectionStatuses.some((s) => s === "NOT_STARTED")) return "GENERATION_IN_PROGRESS";
  if (input.sectionAlreadyRegenerating) return "SECTION_BUSY";
  if (input.recentRegenerations >= SECTION_REGENERATIONS_PER_HOUR) return "RATE_LIMITED";
  return null;
}

export const SECTION_REGENERATION_BLOCK_MESSAGE: Record<SectionRegenerationBlock, string> = {
  DRAFT_SUPERSEDED: "This is an older version of the report. Open the current version to regenerate sections.",
  DRAFT_NOT_EDITABLE: "Sections can only be regenerated while the report is a draft.",
  GENERATION_IN_PROGRESS: "The report is still being written. Wait for every section to finish, then try again.",
  SECTION_BUSY: "This section is already being rewritten.",
  RATE_LIMITED: `You can regenerate up to ${SECTION_REGENERATIONS_PER_HOUR} sections per hour for one report. Try again later.`,
};

/** Normalises the optional instruction: trimmed, empty → undefined. */
export function normalizeSectionInstruction(instruction: string | undefined): string | undefined {
  const trimmed = instruction?.trim();
  return trimmed ? trimmed : undefined;
}
