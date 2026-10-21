import { readFileSync } from "fs";
import { join } from "path";

/** Articles ship inside the app (apps/web/content/support), resolved from the server's working directory. */
const SUPPORT_CONTENT_BASE = process.env.SUPPORT_CONTENT_DIR ?? join(process.cwd(), "content", "support");

export interface LoadedArticle {
  title: string;
  content: string;
  description: string;
}

export function loadArticle(relPath: string): LoadedArticle | null {
  try {
    const fullPath = join(SUPPORT_CONTENT_BASE, relPath);
    const raw = readFileSync(fullPath, "utf-8");
    const lines = raw.split("\n");
    const titleLine = lines.find((l) => l.startsWith("# "));
    const title = titleLine ? titleLine.slice(2).trim() : "Untitled";
    const description =
      lines
        .find((l) => l.startsWith(">") || (!l.startsWith("#") && l.trim().length > 20))
        ?.replace(/^#+\s*/, "")
        .trim()
        .slice(0, 120) ?? "";
    // The page template renders the title as the single <h1>; drop the markdown's own.
    const content = titleLine ? raw.replace(titleLine, "").replace(/^\s+/, "") : raw;
    return { title, content, description };
  } catch {
    return null;
  }
}

export function buildArticleMap(
  articles: Array<{ href: string; title: string; description: string }>
) {
  return articles.reduce<Record<string, { title: string; description: string }>>((acc, art) => {
    acc[art.href] = { title: art.title, description: art.description };
    return acc;
  }, {});
}
