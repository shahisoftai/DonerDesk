import { readFileSync } from "fs";
import { join } from "path";

const MEMORYBANK_BASE = "/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/memorybank/docs/support";

export interface LoadedArticle {
  title: string;
  content: string;
  description: string;
}

export function loadArticle(relPath: string): LoadedArticle | null {
  try {
    const fullPath = join(MEMORYBANK_BASE, relPath);
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
    return { title, content: raw, description };
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
