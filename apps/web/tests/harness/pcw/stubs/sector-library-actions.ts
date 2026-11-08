import { SECTOR_REGISTRY } from "@donordesk/domain";
import { fail, ok } from "./state";

/** The wizard's library pickers call these; the harness walks the blank path, so each answers that the library is not available here. */
const none = async () => fail("The sector library is not part of this check.");
/** The Start slide lists the sectors from this: the real registry, with no indicators (the harness does not browse them). */
export const browseLibraryAction = async () => ok({
  libraryVersion: "harness", total: 0, groups: [],
  sectors: Object.values(SECTOR_REGISTRY).map((d) => ({ id: d.id, label: d.label, group: d.group, attached: d.attached, count: 0 })),
});
export const sectorPackAction = none;
export const adoptLibraryAction = none;
export const adoptSkeletonAction = none;
export const addLibraryToDraftAction = none;
export const libraryUpdatesAction = none;
export const applyLibraryUpdateAction = none;
export const libraryReviewProgressAction = none;
export const exportReviewSheetAction = none;
export const importReviewSheetAction = none;
export const recordReviewAction = none;
export const setLibraryEntryHiddenAction = none;
