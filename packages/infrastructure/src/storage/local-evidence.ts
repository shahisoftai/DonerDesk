import type { IStorage, IEvidenceStorage, SaveEvidenceInput, EvidenceLocation } from "@donordesk/application";
import { DomainError, type Result } from "@donordesk/domain";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function fail(message: string): Result<never, DomainError> {
  return { ok: false, error: new DomainError("INVARIANT_VIOLATION", message) };
}

/**
 * Byte-backed evidence storage on the local filesystem (default / dev / Phase-1).
 * Delegates the actual blob writes to the existing LocalStorage adapter.
 */
export class LocalEvidenceStorage implements IEvidenceStorage {
  readonly provider = "LOCAL" as const;

  constructor(private readonly storage: IStorage) {}

  async save(input: SaveEvidenceInput): Promise<Result<EvidenceLocation, DomainError>> {
    if (!input.buffer) return fail("Local storage requires the file bytes");
    const ext = input.fileName.split(".").pop()?.toLowerCase() ?? input.fileType;
    const storageKey = `${input.tenantId}/evidence/${input.evidenceId}.${ext}`;
    try {
      const stored = await this.storage.put({
        key: storageKey,
        body: input.buffer,
        contentType: input.fileType,
      });
      return ok({
        provider: "LOCAL",
        fileUrl: stored.url,
        fileSize: input.fileSize,
        storageKey,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Local storage write failed");
    }
  }

  async resolveDownloadUrl(location: EvidenceLocation): Promise<string> {
    return location.fileUrl;
  }

  async remove(location: EvidenceLocation): Promise<void> {
    if (location.storageKey) {
      try {
        await this.storage.remove(location.storageKey);
      } catch {
        // best-effort
      }
    }
  }

  async readBytes(location: EvidenceLocation): Promise<Buffer> {
    if (!location.storageKey) throw new Error("Local evidence has no storage key");
    const storage = this.storage as unknown as { read: (key: string) => Promise<Buffer> };
    if (typeof storage.read !== "function") {
      throw new Error("Underlying storage does not support byte reads");
    }
    return storage.read(location.storageKey);
  }
}
