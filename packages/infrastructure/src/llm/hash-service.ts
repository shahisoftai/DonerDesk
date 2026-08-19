import { createHash } from "node:crypto";
import type { IHashService } from "@donordesk/application";

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * SHA-256 content hashing. The domain stays dependency-free; digests are
 * computed here and validated by domain aggregates.
 */
export class Sha256HashService implements IHashService {
  sha256Hex(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
  }

  normalizeAndHash(text: string): string {
    return this.sha256Hex(normalize(text));
  }

  normalize(text: string): string {
    return normalize(text);
  }
}
