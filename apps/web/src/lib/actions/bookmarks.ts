"use server";

import { AddBookmarkSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { BookmarkListSchema, BookmarkSchema, type BookmarkView } from "@/lib/server/schemas-bookmarks";

/** The signed-in person's own bookmarks (Phase 34.7). */
export async function listBookmarksAction(): Promise<Result<BookmarkView[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest("/v1/bookmarks", BookmarkListSchema, context.token);
  return result.ok ? { ok: true, value: result.value.bookmarks } : result;
}

export async function addBookmarkAction(input: unknown): Promise<Result<BookmarkView, AppError>> {
  const context = await requireSession();
  const parsed = AddBookmarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "That page cannot be bookmarked.", fields: {} } };
  return gatewayRequest("/v1/bookmarks", BookmarkSchema, context.token, { method: "POST", body: parsed.data });
}

export async function removeBookmarkAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/bookmarks/${encodeURIComponent(id)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}
