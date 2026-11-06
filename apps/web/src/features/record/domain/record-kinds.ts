/**
 * What a person can record (Phase 44): the one table. The Record sheet, the header menu, the phone's Today buttons and the offline
 * pack all read it; nothing else in the app branches on a kind's name. A new kind is one row here, one form and one outbox sender.
 */
import type { Capability } from "../../../lib/shared/capabilities.ts";

export type RecordKindKey = "NUMBER" | "ACTIVITY" | "FILE" | "EXPENSE" | "FORM";

/** How far a kind works without a connection. */
export type OfflineLevel =
  /** Needs the server: nothing is kept for later. */
  | "ONLINE_ONLY"
  /** Fills in with a connection that is there when the page opens, and is kept and sent later if it drops. */
  | "QUEUED"
  /** Works from the offline pack with no connection at all, and is queued. */
  | "PACKED";

/** What the offline pack must carry for a kind to work from it. */
export type PackPart = "indicators" | "periods" | "places" | "plan" | "forms";

export type RecordIcon = "number" | "done" | "photo" | "money" | "form";

export interface RecordKind {
  key: RecordKindKey;
  /** Catalogue keys (`record.kind.<KEY>` and `record.kind.<KEY>.hint`). */
  labelKey: `record.kind.${RecordKindKey}`;
  hintKey: `record.kind.${RecordKindKey}.hint`;
  /** The person needs ANY of these. */
  anyOf: readonly Capability[];
  offline: OfflineLevel;
  /** The outbox kind that carries it, when it has one. */
  outboxKind: string | null;
  packParts: readonly PackPart[];
  icon: RecordIcon;
}

export const RECORD_KINDS: readonly RecordKind[] = [
  { key: "NUMBER", labelKey: "record.kind.NUMBER", hintKey: "record.kind.NUMBER.hint", anyOf: ["indicator.update"], offline: "PACKED", outboxKind: "indicator-values", packParts: ["indicators", "periods"], icon: "number" },
  { key: "ACTIVITY", labelKey: "record.kind.ACTIVITY", hintKey: "record.kind.ACTIVITY.hint", anyOf: ["activity.create"], offline: "PACKED", outboxKind: "activity", packParts: ["plan", "places"], icon: "done" },
  // A photo or file on its own has no outbox sender today: offline, photos travel with the activity or form they belong to.
  { key: "FILE", labelKey: "record.kind.FILE", hintKey: "record.kind.FILE.hint", anyOf: ["evidence.upload"], offline: "ONLINE_ONLY", outboxKind: null, packParts: [], icon: "photo" },
  // Expenses go through the plan item's budget today and have no outbox sender: they need a connection.
  { key: "EXPENSE", labelKey: "record.kind.EXPENSE", hintKey: "record.kind.EXPENSE.hint", anyOf: ["workplan.update-own"], offline: "ONLINE_ONLY", outboxKind: null, packParts: [], icon: "money" },
  { key: "FORM", labelKey: "record.kind.FORM", hintKey: "record.kind.FORM.hint", anyOf: ["indicator.update"], offline: "PACKED", outboxKind: "collection-record", packParts: ["forms", "places"], icon: "form" },
] as const;

export interface KindContext {
  has: (capability: Capability) => boolean;
  /** The project has at least one published collection form. Without one the FORM kind is not offered. */
  hasForms: boolean;
}

/** The kinds this person may use here, in table order. */
export function availableKinds(ctx: KindContext, kinds: readonly RecordKind[] = RECORD_KINDS): RecordKind[] {
  return kinds.filter((k) => k.anyOf.some((c) => ctx.has(c)) && (k.key !== "FORM" || ctx.hasForms));
}

/** The kind to open first: the one used last when it is still allowed, else the first allowed one. */
export function startingKind(available: readonly RecordKind[], last?: string | undefined): RecordKind | undefined {
  return available.find((k) => k.key === last) ?? available[0];
}

/** The pack parts a person's available kinds need, without repeats, so the pack carries only what will be used. */
export function packPartsFor(available: readonly RecordKind[]): PackPart[] {
  return [...new Set(available.flatMap((k) => k.packParts))];
}
