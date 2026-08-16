import { createHmac, createHash } from "node:crypto";
import type { IEvidenceStorage, SaveEvidenceInput, EvidenceLocation } from "@donordesk/application";
import { DomainError, type Result } from "@donordesk/domain";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function fail(message: string): Result<never, DomainError> {
  return { ok: false, error: new DomainError("INVARIANT_VIOLATION", message) };
}

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base URL for served objects; defaults to the R2 public bucket URL. */
  publicBaseUrl?: string;
}

/**
 * Byte-backed evidence storage on Cloudflare R2 (S3-compatible). Used for the
 * paid tier and for automatic DR mirrors of Drive-backed evidence. Signs each
 * request with AWS Signature V4 (S3 path-style: r2.cloudflarestorage.com).
 */
export class R2EvidenceStorage implements IEvidenceStorage {
  readonly provider = "R2" as const;

  constructor(private readonly config: R2StorageConfig) {}

  get baseUrl(): string {
    return this.config.publicBaseUrl ?? `https://pub-${this.config.accountId}.r2.dev`;
  }

  async save(input: SaveEvidenceInput): Promise<Result<EvidenceLocation, DomainError>> {
    if (!input.buffer) return fail("R2 storage requires the file bytes");
    const ext = input.fileName.split(".").pop()?.toLowerCase() ?? input.fileType;
      const key = `${input.tenantId}/evidence/${input.evidenceId}.${ext}`;
      try {
        await this.putObject(key, input.buffer, input.fileType);
        const path = key.split("/").map(encodeURIComponent).join("/");
        return ok({
          provider: "R2",
          fileUrl: `${this.baseUrl}/${path}`,
          fileSize: input.fileSize,
          storageKey: key,
        });
      } catch (error) {
      return fail(error instanceof Error ? error.message : "R2 write failed");
    }
  }

  async resolveDownloadUrl(location: EvidenceLocation): Promise<string> {
    if (!location.storageKey) return location.fileUrl;
    const path = location.storageKey.split("/").map(encodeURIComponent).join("/");
    return `${this.baseUrl}/${path}`;
  }

  async remove(location: EvidenceLocation): Promise<void> {
    if (!location.storageKey) return;
    try {
      await this.deleteObject(location.storageKey);
    } catch {
      // best-effort
    }
  }

  async readBytes(location: EvidenceLocation): Promise<Buffer> {
    if (!location.storageKey) throw new Error("R2 evidence has no storage key");
    return this.getObject(location.storageKey);
  }

  private endpoint(): string {
    return `https://${this.config.accountId}.r2.cloudflarestorage.com/${this.config.bucket}`;
  }

  private async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.signedRequest("PUT", key, body, contentType);
  }

  private async getObject(key: string): Promise<Buffer> {
    const response = await this.signedRequest("GET", key);
    if (!response.ok) throw new Error(`R2 GET failed (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }

  private async deleteObject(key: string): Promise<void> {
    await this.signedRequest("DELETE", key);
  }

  private async signedRequest(
    method: "PUT" | "GET" | "DELETE",
    key: string,
    body?: Buffer,
    contentType?: string,
  ): Promise<Response> {
    const region = "auto";
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const host = `${this.config.accountId}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${this.config.bucket}/${key}`;
    const payloadHash = body ? createHash("sha256").update(body).digest("hex") : createHash("sha256").update("").digest("hex");

    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["content-type"] = contentType;

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((h) => `${h}:${headers[h]}`)
      .join("\n");
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalRequest = [
      method,
      canonicalUri,
      "",
      canonicalHeaders,
      "",
      signedHeaders,
      payloadHash,
    ].join("\n");

    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const kDate = createHmac("sha256", `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(region).digest();
    const kService = createHmac("sha256", kRegion).update("s3").digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return fetch(`https://${host}/${this.config.bucket}/${key}`, {
      method,
      headers: { ...headers, Authorization: authorization },
      body,
    });
  }
}
