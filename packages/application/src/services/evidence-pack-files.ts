import type { IStorage } from "../ports/infrastructure.js";

export interface PackCandidate {
  fileName: string;
  storageKey?: string | undefined;
  /** Bytes, when known; used to stay inside the size cap without reading the file first. */
  fileSize?: number | undefined;
}

export interface PackFiles {
  files: Array<{ name: string; buffer: Buffer }>;
  notIncluded: Array<{ name: string; reason: string }>;
}

/** The total a pack may hold: a zip built in memory must not exhaust the server. */
export const EVIDENCE_PACK_MAX_BYTES = 150 * 1024 * 1024;

/**
 * Reads the evidence files an evidence pack contains. A file that lives in the tenant's Drive (no stored bytes), cannot
 * be read, or would take the pack over the size cap is left out and named with its reason instead of silently missing,
 * so the pack's README can say what the reader will not find in it. Names inside the pack are made unique.
 */
export class EvidencePackFileLoader {
  constructor(private readonly storage: IStorage, private readonly maxBytes: number = EVIDENCE_PACK_MAX_BYTES) {}

  async load(candidates: ReadonlyArray<PackCandidate>): Promise<PackFiles> {
    const files: PackFiles["files"] = [];
    const notIncluded: PackFiles["notIncluded"] = [];
    const used = new Set<string>();
    let total = 0;
    for (const c of candidates) {
      if (!c.storageKey) {
        notIncluded.push({ name: c.fileName, reason: "kept in the organisation's own Drive, not stored here" });
        continue;
      }
      if (c.fileSize !== undefined && total + c.fileSize > this.maxBytes) {
        notIncluded.push({ name: c.fileName, reason: "the pack would be too large; download it from the evidence library" });
        continue;
      }
      let buffer: Buffer;
      try {
        buffer = await this.storage.read(c.storageKey);
      } catch {
        notIncluded.push({ name: c.fileName, reason: "the file could not be read" });
        continue;
      }
      if (total + buffer.length > this.maxBytes) {
        notIncluded.push({ name: c.fileName, reason: "the pack would be too large; download it from the evidence library" });
        continue;
      }
      total += buffer.length;
      files.push({ name: uniqueName(c.fileName, used), buffer });
    }
    return { files, notIncluded };
  }
}

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 2; ; n += 1) {
    const next = `${stem}-${n}${ext}`;
    if (!used.has(next)) {
      used.add(next);
      return next;
    }
  }
}
