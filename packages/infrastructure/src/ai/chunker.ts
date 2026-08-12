export interface ChunkResult {
  chunks: Array<{
    text: string;
    tokenCount: number;
    chunkIndex: number;
  }>;
}

const TOKENS_PER_CHUNK = 512;
const TOKEN_OVERLAP = 50;
const AVG_CHARS_PER_TOKEN = 4;

export class EvidenceChunker {
  private readonly chunkSize: number;
  private readonly overlap: number;

  constructor(chunkSize = TOKENS_PER_CHUNK, overlap = TOKEN_OVERLAP) {
    if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new Error("Chunk size must be a positive integer");
    if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
      throw new Error("Chunk overlap must be a non-negative integer smaller than chunk size");
    }
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  chunk(text: string): ChunkResult {
    if (!text || text.trim().length === 0) {
      return { chunks: [] };
    }

    const tokens = this.tokenize(text);
    const chunks: ChunkResult["chunks"] = [];

    if (tokens.length <= this.chunkSize) {
      chunks.push({
        text: this.detokenize(tokens),
        tokenCount: tokens.length,
        chunkIndex: 0,
      });
      return { chunks };
    }

    let start = 0;
    let chunkIndex = 0;

    while (start < tokens.length) {
      const end = Math.min(start + this.chunkSize, tokens.length);
      const chunkTokens = tokens.slice(start, end);
      chunks.push({
        text: this.detokenize(chunkTokens),
        tokenCount: chunkTokens.length,
        chunkIndex,
      });
      chunkIndex++;
      start = end - this.overlap;
      if (start >= tokens.length - this.overlap) break;
    }

    return { chunks };
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .split(" ")
      .filter((t) => t.length > 0);
  }

  private detokenize(tokens: string[]): string {
    return tokens.join(" ");
  }

  estimateTokenCount(text: string): number {
    return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
  }
}

export function createChunker(chunkSize = TOKENS_PER_CHUNK, overlap = TOKEN_OVERLAP): EvidenceChunker {
  return new EvidenceChunker(chunkSize, overlap);
}
