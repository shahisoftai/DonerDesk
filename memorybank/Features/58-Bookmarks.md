# Feature 58: Bookmarks

**DonorDesk Version 3.007 (Phase 34, Home)**
**Status:** built, tested and deployed 2026-10-28 (migration `20261030110000_bookmarks`). Not yet tried by a person in the signed-in app.
**Rules:** `AGENTS.md` → "Phase 34 bookmarks".

## What a person gets

- A **star** in the header of every portal page: **Bookmark** / **Bookmarked** for the page being viewed (path and query).
- A **Bookmarks** panel on the director, manager, field and reviewer Homes (hidden when there are none), each with a remove button.
- Up to **30** per person; the same page cannot be saved twice. Names in four languages.

## Rules

- A bookmark is a title and an in-app address, **never data**; opening it shows the page under the person's own access.
- Only in-app addresses are accepted (one leading slash; no scheme, no `//`, no backslash).
- Always the caller's own: no handler takes a user id; the repository deletes only the caller's row. Each add and remove is audited.
- The Home's "Needs you" strip already serves as the alert strip; no second one was built.

## Not built

Pinning a dashboard or chart as a live Home tile; sharing a bookmark with others.
