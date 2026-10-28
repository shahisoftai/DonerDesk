import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { checkWebhookUrl, isPrivateAddress, ok, TenantId, type Result } from "@donordesk/domain";
import type { ConnectorFetch, IConnectorHttp, IConnectorSecrets, IDataConnectorRepository, StoredDataConnector } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

/**
 * AES-256-GCM for the keys of connectors (Phase 33.7). The key is `CONNECTOR_SECRET_KEY`, 32 random bytes written as base64. Without
 * it nothing is stored (`available` is false): a key is never kept in the clear. Each value has its own random nonce and a tag, so a
 * changed value fails to read instead of reading wrongly.
 */
export class EnvConnectorSecrets implements IConnectorSecrets {
  private readonly key: Buffer | null;

  constructor(raw: string | undefined = process.env.CONNECTOR_SECRET_KEY) {
    const key = raw ? Buffer.from(raw.trim(), "base64") : null;
    this.key = key && key.length === 32 ? key : null;
  }

  get available(): boolean { return this.key !== null; }

  encrypt(plain: string): string {
    if (!this.key) throw new Error("Connector secrets are not configured");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
  }

  decrypt(stored: string): string {
    if (!this.key) throw new Error("Connector secrets are not configured");
    const [version, iv, tag, body] = stored.split(":");
    if (version !== "v1" || !iv || !tag || !body) throw new Error("Unreadable secret");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
  }
}

type Resolve = (host: string) => Promise<string[]>;
type Fetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal; redirect: "manual" }) => Promise<Response>;

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 25_000;

/**
 * Reads one page from the other tool. The address is checked again, the name is resolved and every address it resolves to must be public
 * (a name can point inward), no redirect is followed, the wait is limited and so is the size. The key travels only in the header.
 */
export class SafeConnectorHttp implements IConnectorHttp {
  constructor(
    private readonly resolve: Resolve = async (host) => (await lookup(host, { all: true })).map((a) => a.address),
    private readonly doFetch: Fetch = (url, init) => fetch(url, init),
  ) {}

  async get(rawUrl: string, headers: Record<string, string>): Promise<ConnectorFetch> {
    const url = checkWebhookUrl(rawUrl);
    if (!url.ok) return { ok: false, reason: "UNSAFE_ADDRESS" };
    try {
      const addresses = await this.resolve(url.value.hostname.replace(/^\[|\]$/g, ""));
      if (addresses.length === 0 || addresses.some(isPrivateAddress)) return { ok: false, reason: "UNSAFE_ADDRESS" };
    } catch {
      return { ok: false, reason: "UNREACHABLE" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await this.doFetch(url.value.toString(), { headers, signal: controller.signal, redirect: "manual" });
      if (res.status === 401 || res.status === 403) return { ok: false, reason: "UNAUTHORIZED" };
      if (res.status === 404) return { ok: false, reason: "NOT_FOUND" };
      if (res.status >= 500) return { ok: false, reason: "SERVER_ERROR" };
      // A redirect is not followed: it could lead somewhere the address check never saw.
      if (res.status < 200 || res.status >= 300) return { ok: false, reason: "BAD_REPLY" };
      if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return { ok: false, reason: "TOO_BIG" };
      const text = await res.text();
      if (text.length > MAX_BYTES) return { ok: false, reason: "TOO_BIG" };
      try { return { ok: true, json: JSON.parse(text) }; } catch { return { ok: false, reason: "BAD_REPLY" }; }
    } catch (e) {
      return { ok: false, reason: e instanceof Error && e.name === "AbortError" ? "TIMEOUT" : "UNREACHABLE" };
    } finally {
      clearTimeout(timer);
    }
  }
}

type Row = NonNullable<Awaited<ReturnType<PrismaClient["dataConnector"]["findFirst"]>>>;

const json = <T>(text: string | null, fallback: T): T => { try { return text ? (JSON.parse(text) as T) : fallback; } catch { return fallback; } };

const connectorFrom = (r: Row): StoredDataConnector => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), formId: r.formId, projectId: r.projectId, name: r.name, kind: r.kind === "SURVEYCTO" ? "SURVEYCTO" : "KOBOTOOLBOX",
  serverUrl: r.serverUrl, sourceId: r.sourceId, fieldMap: json(r.fieldMapJson, []), ...(r.credentialEnc ? { credentialEnc: r.credentialEnc } : {}),
  ...(r.cursor ? { cursor: r.cursor } : {}), ...(r.lastSyncAt ? { lastSyncAt: r.lastSyncAt } : {}), ...(r.lastSyncJson ? { lastSync: json<Record<string, unknown>>(r.lastSyncJson, {}) } : {}),
  createdById: r.createdById, createdAt: r.createdAt,
});

export class PrismaDataConnectorRepository implements IDataConnectorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(c: StoredDataConnector): Promise<Result<void>> {
    await this.prisma.dataConnector.create({
      data: {
        id: c.id, tenantId: c.tenantId.toString(), formId: c.formId, projectId: c.projectId, name: c.name, kind: c.kind, serverUrl: c.serverUrl, sourceId: c.sourceId,
        fieldMapJson: JSON.stringify(c.fieldMap), credentialEnc: c.credentialEnc ?? null, createdById: c.createdById,
      },
    });
    return ok(undefined);
  }

  /** Writes every mutable field; `?? null` so a cleared cursor or sync note is cleared (Prisma ignores `undefined`). */
  async update(c: StoredDataConnector): Promise<Result<void>> {
    await this.prisma.dataConnector.updateMany({
      where: { id: c.id, tenantId: c.tenantId.toString() },
      data: {
        name: c.name, kind: c.kind, serverUrl: c.serverUrl, sourceId: c.sourceId, fieldMapJson: JSON.stringify(c.fieldMap), credentialEnc: c.credentialEnc ?? null,
        cursor: c.cursor ?? null, lastSyncAt: c.lastSyncAt ?? null, lastSyncJson: c.lastSync ? JSON.stringify(c.lastSync) : null,
      },
    });
    return ok(undefined);
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.dataConnector.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredDataConnector | null>> {
    const row = await this.prisma.dataConnector.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? connectorFrom(row) : null);
  }

  async listByForm(formId: string, tenantId: TenantId): Promise<Result<StoredDataConnector[]>> {
    const rows = await this.prisma.dataConnector.findMany({ where: { formId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map(connectorFrom));
  }
}
