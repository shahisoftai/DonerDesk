function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9À-ɏ؀-ۿ]+/g, " ")
    .trim();
}

function trigrams(words: string[]): string[] {
  if (words.length < 3) return [words.join(" ")];
  const out: string[] = [];
  for (let i = 0; i + 2 < words.length; i++) out.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
}

/**
 * Checks extracted text against the source template so the LLM cannot add
 * sections, questions or rules the donor never wrote. A candidate is grounded
 * when it appears verbatim (after normalisation) or when enough of its word
 * trigrams occur in the source (tolerates light rewording and line breaks).
 */
export class SourceGrounding {
  private readonly source: string;
  private readonly grams: Set<string>;

  constructor(sourceText: string) {
    this.source = ` ${normalize(sourceText)} `;
    this.grams = new Set(trigrams(this.source.trim().split(" ")));
  }

  /** 0..1 share of the candidate supported by the source. */
  score(candidate: string | undefined): number {
    if (!candidate) return 0;
    const n = normalize(candidate);
    if (!n) return 0;
    if (this.source.includes(` ${n} `) || this.source.includes(n)) return 1;
    const grams = trigrams(n.split(" "));
    const hit = grams.filter((g) => this.grams.has(g)).length;
    return hit / grams.length;
  }

  grounded(candidate: string | undefined, threshold = 0.6): boolean {
    return this.score(candidate) >= threshold;
  }
}
