/**
 * Which places travel on a phone (Phase 63c). A person who works from the offline download needs the places of their own work (the
 * facilities given to them, the places the project's plan names and its areas hold) and the areas above them, so a path reads whole;
 * they do not need the whole organisation's list. Pure: the caller passes the list and the ids it wants.
 */
export interface PackPlace { id: string; parentId?: string | undefined }

export function placeIdsWithAncestors(all: ReadonlyArray<PackPlace>, wanted: Iterable<string>): Set<string> {
  const byId = new Map(all.map((p) => [p.id, p]));
  const keep = new Set<string>();
  for (const id of wanted) {
    let at = byId.get(id);
    // A parent chain is finite (a tree), but a bad row must not loop: stop at a place already kept or one that repeats within this walk.
    const walked = new Set<string>();
    while (at && !walked.has(at.id)) {
      walked.add(at.id);
      keep.add(at.id);
      at = at.parentId ? byId.get(at.parentId) : undefined;
    }
  }
  return keep;
}
