/**
 * Comments as conversations: a first comment and the replies under it, one level deep. A thread is open or resolved as a whole (the
 * first comment carries the state, who resolved it and when). Pure; nothing here talks to storage.
 */
export interface ThreadComment {
  id: string;
  parentId?: string | undefined;
  status: "OPEN" | "RESOLVED";
  authorId: string;
  commentText: string;
  createdAt: Date;
  resolvedById?: string | undefined;
  resolvedAt?: Date | undefined;
}

export interface CommentThread<T extends ThreadComment = ThreadComment> {
  root: T;
  replies: T[];
  status: "OPEN" | "RESOLVED";
  resolvedById?: string | undefined;
  resolvedAt?: Date | undefined;
}

/** Threads oldest first, replies oldest first. A reply whose first comment is missing is shown as a thread of its own, never dropped. */
export function buildThreads<T extends ThreadComment>(comments: ReadonlyArray<T>): Array<CommentThread<T>> {
  const byTime = (a: T, b: T): number => a.createdAt.getTime() - b.createdAt.getTime();
  const ids = new Set(comments.map((c) => c.id));
  const roots = comments.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byTime);
  return roots.map((root) => ({
    root,
    replies: comments.filter((c) => c.parentId === root.id).sort(byTime),
    status: root.status,
    resolvedById: root.resolvedById,
    resolvedAt: root.resolvedAt,
  }));
}

export type ReplyCheck = { ok: true } | { ok: false; reason: string };

/** Whether a reply may be added under `parent` on the same thing: replies are one level deep and a resolved thread is reopened first. */
export function checkReply(parent: { parentId?: string | undefined; status: "OPEN" | "RESOLVED"; entityType: string; entityId: string }, on: { entityType: string; entityId: string }): ReplyCheck {
  if (parent.entityType !== on.entityType || parent.entityId !== on.entityId) return { ok: false, reason: "That comment belongs to something else." };
  if (parent.parentId) return { ok: false, reason: "Reply to the first comment of the thread." };
  if (parent.status === "RESOLVED") return { ok: false, reason: "This thread is resolved. Reopen it to reply." };
  return { ok: true };
}
