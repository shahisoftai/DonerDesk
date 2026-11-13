/** A support article reduced to what a search needs. */
export interface HelpDoc {
  href: string;
  title: string;
  /** Headings of the article, one per line of the outline. */
  headings: string[];
  body: string;
}

export interface HelpHit {
  href: string;
  title: string;
  snippet: string;
  score: number;
}

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "do", "does", "how", "i", "my", "me", "can", "what", "with", "it", "this", "that", "be", "by", "from", "at", "as"]);

export function helpWords(text: string): string[] {
  return [...new Set(text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)))];
}

/** A sentence of the body that carries the most of the words, so the person sees why the article was offered. */
function snippetFor(body: string, words: string[]): string {
  const sentences = body.replace(/[#>*|`_-]+/g, " ").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 25);
  let best = "";
  let bestCount = 0;
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const count = words.filter((w) => lower.includes(w)).length;
    if (count > bestCount) { best = s; bestCount = count; }
  }
  return (best || sentences[0] || "").slice(0, 200);
}

/**
 * Keyword search over the help articles: no model, so it costs nothing and never invents an answer. A word in the title counts most, then a
 * heading, then the text; an article must hold at least one word of the question, and a question of only stop words finds nothing.
 */
export function rankHelp(query: string, docs: readonly HelpDoc[], limit = 5): HelpHit[] {
  const words = helpWords(query);
  if (words.length === 0) return [];
  const hits: HelpHit[] = [];
  for (const doc of docs) {
    const title = doc.title.toLowerCase();
    const headings = doc.headings.join("\n").toLowerCase();
    const body = doc.body.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 6;
      if (headings.includes(w)) score += 3;
      if (body.includes(w)) score += 1;
    }
    if (score > 0) hits.push({ href: doc.href, title: doc.title, snippet: snippetFor(doc.body, words), score });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
