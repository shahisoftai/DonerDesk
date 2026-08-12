"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addCommentAction, listCommentsAction, resolveCommentAction } from "@/lib/actions/comments";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/data/Badge";
import { formatDateTime } from "@/lib/shared/dates";

export type CommentableEntityType =
  | "report_section"
  | "evidence"
  | "indicator_update"
  | "checklist_item"
  | "activity_update";

export type CommentItem = {
  id: string;
  commentText: string;
  authorId?: string;
  status?: string;
  createdAt?: string;
};

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
  const [comments, setComments] = useState<CommentItem[]>(initialComments ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const result = await actionState.run(() =>
      addCommentAction({ entityType, entityId, commentText: value }),
    );
    if (result) {
      setText("");
      setComments((prev) => [...prev, { id: result.id, commentText: value, status: "OPEN" }]);
      router.refresh();
    }
  }

  async function resolve(id: string) {
    const result = await actionState.run(() => resolveCommentAction(id));
    if (result !== undefined) {
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, status: "RESOLVED" } : c)));
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="comments-title" className="card">
      <h2 id="comments-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {heading}
      </h2>
      {loadError && <p className="mt-2 text-sm text-danger-700 dark:text-danger-400">{loadError}</p>}
      <ul className="mt-3 space-y-3">
        {comments.length === 0 && (
          <li className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {c.authorId ? `User ${c.authorId.slice(0, 8)}` : "User"} · {formatDateTime(c.createdAt)}
              </span>
              <Badge tone={c.status === "RESOLVED" ? "success" : "info"}>
                {c.status === "RESOLVED" ? "Resolved" : "Open"}
              </Badge>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{c.commentText}</p>
            {c.status !== "RESOLVED" && (
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => resolve(c.id)}>
                Resolve
              </Button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-4 space-y-2">
        <label className="label" htmlFor={`comment-${entityId}`}>Add a comment</label>
        <Textarea
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
