/** What the list of a person's setups says about each (the fields the wizard needs to decide whether to resume one). */
export interface DraftListItem { id: string; status: string; sourceName: string; appliedProjectId?: string | null | undefined; updatedAt: string }

/**
 * The person's latest draft that is still open and was started with no documents: opening the wizard again carries on with it
 * instead of making another. A draft that read documents has its own page, and one already started as a project is finished.
 */
export function latestOpenBlankDraft(list: readonly DraftListItem[]): DraftListItem | null {
  const open = list.filter((d) => d.status === "READY" && d.sourceName === "" && !d.appliedProjectId);
  return [...open].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
