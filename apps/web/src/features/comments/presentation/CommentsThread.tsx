"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addCommentAction, listCommentsAction, reopenCommentAction, resolveCommentAction } from "@/lib/actions/comments";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/data/Badge";
import { formatDateTime } from "@/lib/shared/dates";
import { buildThreads } from "@donordesk/domain/contexts/tasks/comment-thread.js";

export type CommentableEntityType =
  | "report_section"
  | "evidence"
  | "indicator_update"
  | "checklist_item"
  | "activity_update"
  | "indicator"
  | "planned_activity"
  | "project_risk"
  | "report_claim";

export type CommentItem = {
  id: string;
  commentText: string;
  authorId?: string;
  authorName?: string;
  status?: string;
  parentId?: string;
  resolvedById?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt?: string;
};

/** A person is shown by name; an id is never shown to a reader. */
const who = (name?: string): string => name ?? "A team member";

/**
 * Comments as conversations: a first comment and the replies under it. A thread is resolved or reopened as a whole, and says who
 * resolved it and when; a resolved thread takes no replies until it is reopened.
 */
export function CommentsThread({
  entityType,
  entityId,
  initialComments,
  heading = "Comments",
}: {
  entityType: CommentableEntityType;
  entityId: string;
  initialComments?: CommentItem[];
  heading?: string;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [comments, setComments] = useState<CommentItem[]>(initialComments ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reload() {
    const r = await listCommentsAction(entityType, entityId);
    if (r.ok) setComments(r.value as CommentItem[]);
    router.refresh();
  }

  useEffect(() => {
    let cancelled = false;
    if (initialComments) return;
    setComments([]);
    void (async () => {
      const r = await listCommentsAction(entityType, entityId);
      if (cancelled) return;
      if (!r.ok) {
        setLoadError(r.error.message);
        return;
      }
      setComments(r.value as CommentItem[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, initialComments]);

  const threads = useMemo(
    () =>
      buildThreads(
        comments.map(({ resolvedAt, ...c }) => ({
          ...c,
          status: (c.status === "RESOLVED" ? "RESOLVED" : "OPEN") as "OPEN" | "RESOLVED",
          authorId: c.authorId ?? "",
          createdAt: new Date(c.createdAt ?? 0),
          ...(resolvedAt ? { resolvedAt: new Date(resolvedAt) } : {}),
        })),
      ),
    [comments],
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const result = await actionState.run(() => addCommentAction({ entityType, entityId, commentText: value }));
    if (result) {
      setText("");
      await reload();
    }
  }

  async function reply(e: React.FormEvent, parentId: string) {
    e.preventDefault();
    const value = replyText.trim();
    if (!value) return;
    const result = await actionState.run(() => addCommentAction({ entityType, entityId, commentText: value, parentId }));
    if (result) {
      setReplyText("");
      setReplyTo(null);
      await reload();
    }
  }

  async function change(id: string, action: typeof resolveCommentAction) {
    const result = await actionState.run(() => action(id));
    if (result !== undefined) await reload();
  }

  return (
    <section aria-labelledby="comments-title" className="card">
      <h2 id="comments-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {heading}
      </h2>
      {loadError && <p className="mt-2 text-sm text-danger-700 dark:text-danger-400">{loadError}</p>}
      <ul className="mt-3 space-y-3">
        {threads.length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</li>}
        {threads.map((t) => (
          <li key={t.root.id} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>{who(t.root.authorName)} · {formatDateTime(t.root.createdAt.toISOString())}</span>
              <Badge tone={t.status === "RESOLVED" ? "success" : "info"}>{t.status === "RESOLVED" ? "Resolved" : "Open"}</Badge>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{t.root.commentText}</p>

            {t.replies.length > 0 && (
              <ul className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3 dark:border-white/10">
                {t.replies.map((r) => (
                  <li key={r.id}>
                    <span className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>{who(r.authorName)} · {formatDateTime(r.createdAt.toISOString())}</span>
                    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{r.commentText}</p>
                  </li>
                ))}
              </ul>
            )}

            {t.status === "RESOLVED" && t.resolvedAt && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>Resolved by {who(t.root.resolvedByName)} · {formatDateTime(t.resolvedAt.toISOString())}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              {t.status === "OPEN" ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(replyTo === t.root.id ? null : t.root.id)}>Reply</Button>
                  <Button size="sm" variant="ghost" onClick={() => void change(t.root.id, resolveCommentAction)}>Resolve</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => void change(t.root.id, reopenCommentAction)}>Reopen</Button>
              )}
            </div>

            {replyTo === t.root.id && t.status === "OPEN" && (
              <form onSubmit={(e) => void reply(e, t.root.id)} className="mt-2 space-y-2">
                <Textarea aria-label="Your reply" rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={5000} placeholder="Reply…" />
                <Button type="submit" size="sm" pending={actionState.busy} disabled={!replyText.trim()}>Send reply</Button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-4 space-y-2">
        <label className="label" htmlFor={`comment-${entityId}`}>Add a comment</label>
        <Textarea dictate
          id={`comment-${entityId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          rows={3}
          placeholder="Leave a note for reviewers…"
        />
        {actionState.error && (
          <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">
            {actionState.error}
          </p>
        )}
        <Button type="submit" size="sm" pending={actionState.busy} disabled={!text.trim()}>
          Add comment
        </Button>
      </form>
    </section>
  );
}
