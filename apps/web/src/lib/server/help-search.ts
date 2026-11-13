import { readFileSync } from "fs";
import { join } from "path";
import { HELP_ARTICLES } from "@/features/help/domain/help-index";
import { rankHelp, type HelpDoc, type HelpHit } from "@/features/help/domain/help-rank";

/** Same folder the support pages read (see components/support/wikiUtils.ts). */
const BASE = process.env.SUPPORT_CONTENT_DIR ?? join(process.cwd(), "content", "support");

let cache: HelpDoc[] | null = null;

function docs(): HelpDoc[] {
  if (cache) return cache;
  const seen = new Set<string>();
  const loaded: HelpDoc[] = [];
  for (const entry of HELP_ARTICLES) {
    if (seen.has(entry.href)) continue;
    seen.add(entry.href);
    try {
      const raw = readFileSync(join(BASE, entry.file), "utf-8");
      const lines = raw.split("\n");
      loaded.push({
        href: entry.href,
        title: lines.find((l) => l.startsWith("# "))?.slice(2).trim() ?? entry.href,
        headings: lines.filter((l) => /^#{2,4}\s/.test(l)).map((l) => l.replace(/^#+\s*/, "")),
        body: raw,
      });
    } catch {
      // An article that cannot be read is left out of the search, never an error for the person asking.
    }
  }
  cache = loaded;
  return loaded;
}

export function searchHelp(query: string): HelpHit[] {
  return rankHelp(query.slice(0, 200), docs());
}
