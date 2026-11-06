/**
 * What can carry a comment, and who is told. One table: a new commentable thing is one row (OCP). "MENTIONS" things
 * tell only the person mentioned; "PEOPLE" things also tell the people who own the thing (never the commenter).
 */
export type CommentableType =
  | "report_section" | "evidence" | "indicator_update" | "checklist_item" | "activity_update"
  | "indicator" | "planned_activity" | "project_risk" | "report_claim" | "infographic";

export type CommentAudience = "MENTIONS" | "PEOPLE";

export const COMMENTABLE_ENTITIES: Readonly<Record<CommentableType, { label: string; audience: CommentAudience }>> = {
  report_section: { label: "report section", audience: "MENTIONS" },
  evidence: { label: "file", audience: "PEOPLE" },
  indicator_update: { label: "indicator value", audience: "MENTIONS" },
  checklist_item: { label: "checklist item", audience: "MENTIONS" },
  activity_update: { label: "completed activity", audience: "PEOPLE" },
  indicator: { label: "indicator", audience: "PEOPLE" },
  planned_activity: { label: "planned activity", audience: "PEOPLE" },
  project_risk: { label: "problem or risk", audience: "PEOPLE" },
  report_claim: { label: "statement in a report", audience: "MENTIONS" },
  infographic: { label: "infographic", audience: "PEOPLE" },
};

export const COMMENTABLE_TYPES = Object.keys(COMMENTABLE_ENTITIES) as CommentableType[];

/** Who hears about a comment: the person mentioned plus, for "PEOPLE" things, the owners; never the author; no duplicates. */
export function commentRecipients(type: CommentableType, authorId: string, mentionedUserId: string | undefined, owners: ReadonlyArray<string>, threadAuthorId?: string): string[] {
  // A reply also tells the person who started the thread.
  const all = [...(mentionedUserId ? [mentionedUserId] : []), ...(threadAuthorId ? [threadAuthorId] : []), ...(COMMENTABLE_ENTITIES[type].audience === "PEOPLE" ? owners : [])];
  return [...new Set(all)].filter((id) => id && id !== authorId);
}
