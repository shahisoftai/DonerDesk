import type { DomainEvent } from "./domain-event.js";

export interface ConflictFreeAggregateProps {
  version: number;
  lastModifiedBy: string;
  lastModifiedRegion?: string;
}

export interface VectorClock {
  region: string;
  timestamp: number;
  counter: number;
}

export interface ConflictResolution<T> {
  resolved: T;
  conflicts: Array<{
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    resolution: "local" | "remote" | "merged" | "latest_timestamp";
  }>;
}

export class ConflictFreeEntity<T extends { version: number }> {
  protected constructor(
    protected id: string,
    protected tenantId: string,
    protected props: T,
    protected version: number,
    protected vectorClock: VectorClock[],
    protected createdAt: Date,
    protected updatedAt: Date,
  ) {}

  static merge<T extends { version: number }>(
    local: ConflictFreeEntity<T>,
    remote: ConflictFreeEntity<T>,
    remoteRegion: string,
  ): ConflictResolution<T> {
    const conflicts: ConflictResolution<T>["conflicts"] = [];

    if (remote.version > local.version) {
      conflicts.push({
        field: "_version",
        localValue: local.version,
        remoteValue: remote.version,
        resolution: "remote",
      });
    }

    return {
      resolved: remote.props,
      conflicts,
    };
  }
}

export interface ReplicationMessage<T> {
  entityId: string;
  tenantId: string;
  entityType: string;
  operation: "create" | "update" | "delete";
  payload: T;
  vectorClock: VectorClock[];
  timestamp: number;
  originRegion: string;
}

export class MultiRegionConflictResolver {
  static lastWriterWins<T extends { updatedAt: Date }>(
    local: T,
    remote: T,
  ): T {
    if (remote.updatedAt > local.updatedAt) {
      return remote;
    }
    return local;
  }

  static fieldMerge<T extends object>(
    local: T,
    remote: T,
    fieldsToMerge: (keyof T)[],
  ): { merged: T; conflicts: Array<{ field: keyof T; localValue: unknown; remoteValue: unknown }> } {
    const merged = { ...local };
    const conflicts: Array<{ field: keyof T; localValue: unknown; remoteValue: unknown }> = [];

    for (const field of fieldsToMerge) {
      const localValue = local[field];
      const remoteValue = remote[field];

      if (localValue !== remoteValue) {
        conflicts.push({ field, localValue, remoteValue });
      }

      if (remoteValue !== undefined && remoteValue !== null) {
        (merged as Record<string, unknown>)[field as string] = remoteValue;
      }
    }

    return { merged, conflicts };
  }

  static vectorClockCompare(a: VectorClock[], b: VectorClock[]): "before" | "after" | "concurrent" | "equal" {
    const clockA = collapseClock(a);
    const clockB = collapseClock(b);

    let aGreater = false;
    let bGreater = false;

    const allRegions = new Set([...clockA.keys(), ...clockB.keys()]);

    for (const region of allRegions) {
      const entryA = clockA.get(region);
      const entryB = clockB.get(region);

      const ctA = entryA?.counter ?? 0;
      const ctB = entryB?.counter ?? 0;

      if (ctA > ctB) {
        aGreater = true;
      }
      if (ctB > ctA) {
        bGreater = true;
      }
    }

    if (aGreater && !bGreater) return "after";
    if (bGreater && !aGreater) return "before";
    if (!aGreater && !bGreater) return "equal";
    return "concurrent";
  }

  static deduplicateEvents<T extends DomainEvent>(events: T[]): T[] {
    const seen = new Set<string>();
    const deduplicated: T[] = [];

    const sorted = [...events].sort((a, b) => {
      const tsA = aOccurredAt(a) ?? new Date(0);
      const tsB = aOccurredAt(b) ?? new Date(0);
      return tsA.getTime() - tsB.getTime();
    });

    for (const event of sorted) {
      const key = `${event.eventName}:${event.eventId}:${aOccurredAt(event)?.toISOString()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(event);
      }
    }

    return deduplicated;
  }
}

function collapseClock(clock: VectorClock[]): Map<string, VectorClock> {
  const collapsed = new Map<string, VectorClock>();
  for (const entry of clock) {
    if (!entry.region.trim() || !Number.isSafeInteger(entry.counter) || entry.counter < 0) continue;
    const current = collapsed.get(entry.region);
    if (!current || entry.counter > current.counter) collapsed.set(entry.region, entry);
  }
  return collapsed;
}

function aOccurredAt(event: DomainEvent): Date | undefined {
  return (event as unknown as { occurredAt?: Date }).occurredAt;
}
