/**
 * Who else has a canvas open right now (Phase 48.8). Presence is held in memory, in this process: a restart forgets it and everyone's page
 * reconnects and says again, so nothing is stored and nothing is audited. An entry that has not been refreshed for `TTL_MS` is gone.
 * It carries a person's id, their name, the block they have selected and whether they are editing: never a figure and never an edit.
 */
export interface PresenceEntry { userId: string; name: string; blockId: string | null; editing: boolean }
export const PRESENCE_TTL_MS = 45_000;

export class InMemoryPresence {
  private readonly rooms = new Map<string, Map<string, PresenceEntry & { seen: number }>>();
  private readonly listeners = new Map<string, Set<() => void>>();

  /** A person says they are here (and what they are doing). Everyone in the room is told when something changed. */
  touch(room: string, entry: PresenceEntry, now = Date.now()): void {
    const people = this.rooms.get(room) ?? new Map();
    const before = people.get(entry.userId);
    people.set(entry.userId, { ...entry, seen: now });
    this.rooms.set(room, people);
    if (!before || before.blockId !== entry.blockId || before.editing !== entry.editing || before.name !== entry.name) this.notify(room);
  }

  leave(room: string, userId: string): void {
    const people = this.rooms.get(room);
    if (people?.delete(userId)) this.notify(room);
    if (people && people.size === 0) this.rooms.delete(room);
  }

  /** Everyone in the room except `userId`, whose entry is still fresh. */
  others(room: string, userId: string, now = Date.now()): PresenceEntry[] {
    const people = this.rooms.get(room);
    if (!people) return [];
    return [...people.values()].filter((p) => p.userId !== userId && now - p.seen < PRESENCE_TTL_MS).map(({ seen: _seen, ...entry }) => entry);
  }

  subscribe(room: string, listener: () => void): () => void {
    const set = this.listeners.get(room) ?? new Set();
    set.add(listener);
    this.listeners.set(room, set);
    return () => { set.delete(listener); if (set.size === 0) this.listeners.delete(room); };
  }

  /** Drops entries nobody refreshed; returns how many rooms changed. Called now and then by whoever holds the registry. */
  sweep(now = Date.now()): number {
    let changed = 0;
    for (const [room, people] of this.rooms) {
      let dropped = false;
      for (const [id, p] of people) if (now - p.seen >= PRESENCE_TTL_MS) { people.delete(id); dropped = true; }
      if (people.size === 0) this.rooms.delete(room);
      if (dropped) { changed += 1; this.notify(room); }
    }
    return changed;
  }

  private notify(room: string): void { for (const l of this.listeners.get(room) ?? []) l(); }
}
