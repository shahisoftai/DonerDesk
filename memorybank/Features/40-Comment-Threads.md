# Feature 40: Comment threads

**DonorDesk Version 2.007** · **Shipped:** 2026-10-21, release `20261021075101` (threads); action-result fix that made Resolve and Reopen refresh in `20261021080953` · **Audit:** CG-10 (§17)

## 1. What a person gets

- A **first comment** and **replies** under it (one level deep).
- **Resolve** closes the thread and shows who did it and when ("Resolved by User 1234abcd · time").
- **Reopen** opens it again; a resolved thread takes no replies until reopened.
- Comments can now sit on a **statement in a report** (a claim in the Statements tab), so a reviewer can discuss one sentence.
- A reply tells the person who started the thread, as well as the people already told (mentions, owners).

## 2. Rules that matter

- **Threads, not lists:** only the first comment carries the state. Replies are refused on a resolved thread, a reply to a reply, or a comment on a different item.
- **Who is told:** the mentioned person, the thread's author (for replies), and for "PEOPLE" items the owners; never the author; no duplicates (`commentRecipients`).
- **Statements are keyed by wording, not id:** a statement's comments hang from `<sectionId>:<fingerprint>`, because claim ids are recreated on every re-check.
- **Counts:** open-comment counts count threads, not replies.

## 3. Code map

| Layer | File |
|---|---|
| Thread rules (pure) | `packages/domain/src/contexts/tasks/comment-thread.ts` (`buildThreads`, `checkReply`) |
| Who is told | `packages/domain/src/contexts/tasks/commentable.ts` (`report_claim` added) |
| Handlers | `packages/application/src/use-cases/support/add-comment.ts`, `resolve-comment.ts` (`ResolveCommentHandler`, `ReopenCommentHandler`) |
| Persistence | `Comment.parentId`, `resolvedById`, `resolvedAt` (migration `20261022160000_comment_threads`) |
| Routes | `POST /v1/comments` (with `parentId`), `POST /v1/comments/:id/resolve`, `…/reopen` |
| Screen | `apps/web/src/features/comments/presentation/CommentsThread.tsx` |

Tests: `packages/domain/test/comment-thread.test.mjs`, `packages/application/test/comment-threads.test.mjs`.

## 4. Left over

- Only one level of replies (no nested conversations).
- No edit or delete of a comment after it is posted.
- No email digest of replies; they appear as in-app notifications.
