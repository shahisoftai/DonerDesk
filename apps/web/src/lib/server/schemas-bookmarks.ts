import { z } from "zod";

export const BookmarkSchema = z.object({ id: z.string(), title: z.string(), href: z.string() });
export type BookmarkView = z.infer<typeof BookmarkSchema>;
export const BookmarkListSchema = z.object({ bookmarks: z.array(BookmarkSchema) });
