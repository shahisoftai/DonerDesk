/**
 * The words beside an indicator row: "Due by 5 Nov · Amina" while a value is awaited, "Overdue since 5 Nov · Amina" after the
 * due date. Nothing for a value already recorded or not yet due. Pure; never an ISO date or an id.
 */
import { formatShortDate } from "@donordesk/domain/contexts/workplan/index.js";

export interface CollectionShape {
  dueBy: string;
  state: "RECORDED" | "DUE" | "OVERDUE" | "NOT_DUE";
  ownerId?: string | undefined;
}

export function collectionText(collection: CollectionShape | undefined, today: string, userId: string, names: Readonly<Record<string, string>>): string {
  if (!collection || (collection.state !== "DUE" && collection.state !== "OVERDUE")) return "";
  const when = collection.state === "OVERDUE" ? `Overdue since ${formatShortDate(collection.dueBy, today)}` : `Due by ${formatShortDate(collection.dueBy, today)}`;
  const who = collection.ownerId ? (collection.ownerId === userId ? "you" : names[collection.ownerId] ?? "a team member") : "";
  return who ? `${when} · ${who}` : when;
}
