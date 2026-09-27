import { createHash, randomUUID } from "node:crypto";
import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { IStorage, ITemplateFileStore, StoredTemplateFile } from "@donordesk/application";

const MIME_BY_EXT: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
};

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "template";
  const cleaned = base.replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/\s+/g, "_").slice(-120);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "template";
}

function tenantPrefix(tenantId: TenantId): string {
  return `donor-templates/${tenantId.toString()}/`;
}

/**
 * Original donor template files under `donor-templates/<tenantId>/<uuid>/<name>`.
 * The key encodes the owning tenant so `open` can refuse cross-tenant keys
 * supplied by a client.
 */
export class StorageTemplateFileStore implements ITemplateFileStore {
  constructor(private readonly storage: IStorage) {}

  async save(input: { tenantId: TenantId; fileName: string; mimeType: string; buffer: Buffer }): Promise<Result<StoredTemplateFile, DomainError>> {
    const fileName = sanitizeFileName(input.fileName);
    const key = `${tenantPrefix(input.tenantId)}${randomUUID()}/${fileName}`;
    try {
      await this.storage.put({ key, body: input.buffer, contentType: this.mimeFor(fileName, input.mimeType) });
    } catch (error) {
      return { ok: false, error: DomainError.invariant(`Could not store the template file: ${error instanceof Error ? error.message : String(error)}`) };
    }
    return { ok: true, value: { key, fileName, mimeType: this.mimeFor(fileName, input.mimeType), sha256: createHash("sha256").update(input.buffer).digest("hex") } };
  }

  async open(key: string, tenantId: TenantId): Promise<Result<StoredTemplateFile & { buffer: Buffer }, DomainError>> {
    if (!key.startsWith(tenantPrefix(tenantId)) || key.includes("..")) {
      return { ok: false, error: DomainError.forbidden("This template file does not belong to your organisation") };
    }
    let buffer: Buffer;
    try {
      buffer = await this.storage.read(key);
    } catch {
      return { ok: false, error: DomainError.notFound("TemplateFile", key) };
    }
    const fileName = key.split("/").pop() ?? "template";
    return { ok: true, value: { key, fileName, mimeType: this.mimeFor(fileName), sha256: createHash("sha256").update(buffer).digest("hex"), buffer } };
  }

  private mimeFor(fileName: string, fallback?: string): string {
    const ext = fileName.toLowerCase().split(".").pop() ?? "";
    return MIME_BY_EXT[ext] ?? fallback ?? "application/octet-stream";
  }
}
