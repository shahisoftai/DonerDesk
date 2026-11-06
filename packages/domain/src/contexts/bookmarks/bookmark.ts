/**
 * Bookmarks (Phase 34.7): a person's own shortcuts to places in the app, shown on their Home. A bookmark stores a title and an
 * in-app address, never data; opening it shows whatever the page shows today, under the person's own access.
 */
export const MAX_BOOKMARKS = 30;
export const MAX_BOOKMARK_TITLE = 80;
export const MAX_BOOKMARK_HREF = 300;

export interface BookmarkInput { title: string; href: string }
export type BookmarkProblemCode = "TITLE_EMPTY" | "TITLE_TOO_LONG" | "HREF_NOT_IN_APP" | "HREF_TOO_LONG" | "ALREADY_SAVED" | "TOO_MANY";
export interface BookmarkProblem { code: BookmarkProblemCode; message: string }

/** An address inside the app: one leading slash, no scheme, no second slash or backslash (which a browser reads as another site). */
export function isInAppAddress(href: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#:,+@]*$/.test(href);
}

/** The cleaned bookmark, or the reason it cannot be kept. An address already saved is not saved twice. */
export function checkBookmark(input: BookmarkInput, existingHrefs: ReadonlyArray<string>): { ok: true; value: BookmarkInput } | { ok: false; problem: BookmarkProblem } {
  const title = input.title.trim().replace(/\s+/g, " ");
  const href = input.href.trim();
  const no = (code: BookmarkProblemCode, message: string) => ({ ok: false as const, problem: { code, message } });
  if (!title) return no("TITLE_EMPTY", "Give the bookmark a name.");
  if (title.length > MAX_BOOKMARK_TITLE) return no("TITLE_TOO_LONG", `Keep the name to ${MAX_BOOKMARK_TITLE} characters.`);
  if (href.length > MAX_BOOKMARK_HREF) return no("HREF_TOO_LONG", "That address is too long to keep.");
  if (!isInAppAddress(href)) return no("HREF_NOT_IN_APP", "Only pages inside DonorDesk can be bookmarked.");
  if (existingHrefs.includes(href)) return no("ALREADY_SAVED", "That page is already bookmarked.");
  if (existingHrefs.length >= MAX_BOOKMARKS) return no("TOO_MANY", `You can keep ${MAX_BOOKMARKS} bookmarks. Remove one first.`);
  return { ok: true, value: { title, href } };
}
