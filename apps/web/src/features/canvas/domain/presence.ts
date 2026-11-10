/** The people also on a canvas (Phase 48.8). Pure helpers: the words and the order, so the chips are tested without a browser. */
export interface Peer { userId: string; name: string; blockId: string | null; editing: boolean }

/** Peers who are editing come first, then by name; a peer is listed once. */
export function orderPeers(peers: ReadonlyArray<Peer>): Peer[] {
  const seen = new Set<string>();
  return peers.filter((p) => !seen.has(p.userId) && seen.add(p.userId)).sort((a, b) => Number(b.editing) - Number(a.editing) || a.name.localeCompare(b.name));
}

/** The initials shown in a chip: the first letters of up to two words, never empty. */
export function initialsOf(name: string): string {
  const letters = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]!.toUpperCase());
  return letters.join("") || "?";
}

/** Parses one event's data safely: anything that is not a list of peers is no peers (a broken line never breaks the page). */
export function parsePeers(data: string): Peer[] {
  try {
    const v: unknown = JSON.parse(data);
    if (!Array.isArray(v)) return [];
    return v.flatMap((p): Peer[] => (p && typeof p === "object" && typeof (p as Peer).userId === "string" && typeof (p as Peer).name === "string" ? [{ userId: (p as Peer).userId, name: (p as Peer).name, blockId: typeof (p as Peer).blockId === "string" ? (p as Peer).blockId : null, editing: (p as Peer).editing === true }] : []));
  } catch {
    return [];
  }
}
