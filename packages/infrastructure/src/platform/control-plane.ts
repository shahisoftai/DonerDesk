import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";

export const PLATFORM_CATEGORIES = ["LLM", "EMAIL", "OBJECT_STORAGE", "BACKUP", "CONNECTOR"] as const;
export const PLATFORM_PROVIDERS = {
  LLM: ["openai", "anthropic", "deepseek", "minimax"],
  EMAIL: ["brevo", "postmark", "resend", "ses", "smtp"],
  OBJECT_STORAGE: ["cloudflare-r2", "backblaze-b2", "aws-s3", "s3-compatible"],
  BACKUP: ["cloudflare-r2", "backblaze-b2", "aws-s3", "s3-compatible"],
  CONNECTOR: ["kobotoolbox", "odk-central", "google-drive", "sharepoint", "s3-drop-folder"],
} as const;

export type PlatformSession = { sub: string; email: string; role: "SUPER_ADMIN"; purpose: "session" | "mfa" };
type AdminRow = { id: string; email: string; name: string; passwordHash: string; status: string; totpSecretEncrypted: string | null; recoveryCodesHash: string; failedLoginCount: number; lockedUntil: Date | null };
type ConfigurationRow = Record<string, unknown> & { id: string; secretCiphertext: string | null; secretIv: string | null; secretTag: string | null; secretVersion: number };

export class PlatformControlPlane {
  private readonly masterKey: Buffer;
  private readonly jwtSecret: string;
  constructor(private readonly prisma: PrismaClient) {
    const raw = required("PLATFORM_MASTER_KEY");
    this.masterKey = Buffer.from(raw, "base64");
    if (this.masterKey.length !== 32) throw new Error("PLATFORM_MASTER_KEY must be a Base64-encoded 32-byte key");
    this.jwtSecret = required("SUPERADMIN_JWT_SECRET");
  }

  async bootstrap(email: string, name: string, temporaryPassword: string) {
    const count = (await this.query<{ count: bigint }>(`SELECT COUNT(*)::bigint AS count FROM "PlatformAdmin"`))[0]?.count ?? 0n;
    if (count > 0n) throw new Error("Platform administrator already exists");
    const id = randomUUID();
    await this.execute(`INSERT INTO "PlatformAdmin" ("id","email","name","passwordHash","updatedAt") VALUES ($1,$2,$3,$4,NOW())`, id, email.toLowerCase(), name, await bcrypt.hash(temporaryPassword, 12));
    return { id, email: email.toLowerCase(), name };
  }

  async login(email: string, password: string): Promise<{ sessionToken: string }> {
    const admin = (await this.query<AdminRow>(`SELECT * FROM "PlatformAdmin" WHERE "email"=$1 LIMIT 1`, email.toLowerCase()))[0];
    if (!admin || admin.status === "DISABLED") throw new Error("Invalid credentials");
    if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new Error("Account temporarily locked");
    if (!await bcrypt.compare(password, admin.passwordHash)) {
      const attempts = admin.failedLoginCount + 1;
      await this.execute(`UPDATE "PlatformAdmin" SET "failedLoginCount"=$2,"lockedUntil"=$3,"updatedAt"=NOW() WHERE "id"=$1`, admin.id, attempts, attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null);
      throw new Error("Invalid credentials");
    }
    await this.execute(`UPDATE "PlatformAdmin" SET "failedLoginCount"=0,"lockedUntil"=NULL,"updatedAt"=NOW() WHERE "id"=$1`, admin.id);
    await this.execute(`UPDATE "PlatformAdmin" SET "lastLoginAt"=NOW(),"status"='ACTIVE',"updatedAt"=NOW() WHERE "id"=$1`, admin.id);
    return { sessionToken: this.sign(admin, "session", 1800) };
  }

  async beginMfa(token: string) {
    const session = this.verify(token, "mfa");
    const admin = await this.adminById(session.sub);
    if (admin.totpSecretEncrypted) throw new Error("MFA already configured");
    const secret = base32(randomBytes(20));
    await this.execute(`UPDATE "PlatformAdmin" SET "totpSecretEncrypted"=$2,"updatedAt"=NOW() WHERE "id"=$1`, admin.id, this.encryptString(secret));
    return { secret, uri: `otpauth://totp/DonorDesk%20SuperAdmin:${encodeURIComponent(admin.email)}?secret=${secret}&issuer=DonorDesk%20SuperAdmin&algorithm=SHA1&digits=6&period=30` };
  }

  async completeMfa(token: string, code: string): Promise<{ sessionToken: string; recoveryCodes?: string[] }> {
    const session = this.verify(token, "mfa");
    const admin = await this.adminById(session.sub);
    if (!admin.totpSecretEncrypted || !verifyTotp(this.decryptString(admin.totpSecretEncrypted), code)) throw new Error("Invalid authentication code");
    let recoveryCodes: string[] | undefined;
    let recoveryJson = admin.recoveryCodesHash;
    if (admin.recoveryCodesHash === "[]") {
      recoveryCodes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex"));
      recoveryJson = JSON.stringify(recoveryCodes.map(hash));
    }
    await this.execute(`UPDATE "PlatformAdmin" SET "status"='ACTIVE',"lastLoginAt"=NOW(),"recoveryCodesHash"=$2,"updatedAt"=NOW() WHERE "id"=$1`, admin.id, recoveryJson);
    return { sessionToken: this.sign(admin, "session", 1800), recoveryCodes };
  }

  verifySession(token: string) { return this.verify(token, "session"); }

  async listConfigurations() {
    return (await this.query<ConfigurationRow>(`SELECT * FROM "PlatformConfiguration" ORDER BY "category","provider"`)).map(({ secretCiphertext, secretIv, secretTag, ...row }) => ({ ...row, secretConfigured: Boolean(secretCiphertext && secretIv && secretTag) }));
  }

  async upsertConfiguration(actor: PlatformSession, input: { id?: string; scopeType?: string; scopeId?: string; category: string; provider: string; displayName: string; enabled: boolean; configuration: Record<string, unknown>; secrets?: Record<string, string> }, meta?: { ip?: string; userAgent?: string }) {
    if (!PLATFORM_CATEGORIES.includes(input.category as never)) throw new Error("Unsupported configuration category");
    const providers = PLATFORM_PROVIDERS[input.category as keyof typeof PLATFORM_PROVIDERS] as readonly string[];
    if (!providers.includes(input.provider)) throw new Error("Unsupported provider");
    const existing = input.id ? (await this.query<ConfigurationRow>(`SELECT * FROM "PlatformConfiguration" WHERE "id"=$1`, input.id))[0] ?? null : null;
    const encrypted = input.secrets && Object.keys(input.secrets).length ? this.encrypt(JSON.stringify(input.secrets)) : null;
    const id = existing?.id ?? randomUUID(); const scopeType = input.scopeType ?? "GLOBAL"; const scopeId = input.scopeId ?? "GLOBAL";
    if (existing) await this.execute(`UPDATE "PlatformConfiguration" SET "scopeType"=$2,"scopeId"=$3,"category"=$4,"provider"=$5,"displayName"=$6,"enabled"=$7,"configurationJson"=$8,"updatedById"=$9,"secretCiphertext"=COALESCE($10,"secretCiphertext"),"secretIv"=COALESCE($11,"secretIv"),"secretTag"=COALESCE($12,"secretTag"),"secretVersion"=$13,"updatedAt"=NOW() WHERE "id"=$1`, id, scopeType, scopeId, input.category, input.provider, input.displayName, input.enabled, JSON.stringify(input.configuration), actor.sub, encrypted?.ciphertext ?? null, encrypted?.iv ?? null, encrypted?.tag ?? null, encrypted ? existing.secretVersion + 1 : existing.secretVersion);
    else await this.execute(`INSERT INTO "PlatformConfiguration" ("id","scopeType","scopeId","category","provider","displayName","enabled","configurationJson","secretCiphertext","secretIv","secretTag","createdById","updatedById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,NOW())`, id, scopeType, scopeId, input.category, input.provider, input.displayName, input.enabled, JSON.stringify(input.configuration), encrypted?.ciphertext ?? null, encrypted?.iv ?? null, encrypted?.tag ?? null, actor.sub);
    await this.audit(actor, existing ? "configuration.updated" : "configuration.created", "PlatformConfiguration", id, existing, { ...input, secrets: encrypted ? "[ROTATED]" : "[UNCHANGED]" }, meta);
    return { id };
  }

  async deleteConfiguration(actor: PlatformSession, id: string, meta?: { ip?: string; userAgent?: string }) {
    const old = (await this.query<ConfigurationRow>(`DELETE FROM "PlatformConfiguration" WHERE "id"=$1 RETURNING *`, id))[0];
    if (!old) throw new Error("Configuration not found");
    await this.audit(actor, "configuration.deleted", "PlatformConfiguration", id, old, null, meta);
  }

  async overview() {
    const [tenants, users, configs, backups, connectors] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.query<{ count: bigint }>(`SELECT COUNT(*)::bigint AS count FROM "PlatformConfiguration"`).then(x => Number(x[0]?.count ?? 0)),
      this.query(`SELECT * FROM "BackupRun" ORDER BY "startedAt" DESC LIMIT 5`),
      this.query(`SELECT * FROM "ConnectorRun" ORDER BY "startedAt" DESC LIMIT 5`),
    ]);
    return { tenants, users, configurations: configs, backups, connectors };
  }
  listTenants() { return this.prisma.organization.findMany({ include: { _count: { select: { users: true, projects: true } } }, orderBy: { createdAt: "desc" } }); }
  listUsers() { return this.prisma.user.findMany({ select: { id: true, tenantId: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }); }
  async createTenant(actor: PlatformSession, data: { name: string; tenantId: string; organizationType: string; country: string; sectors: string[]; contactName: string; contactEmail: string; website?: string; defaultLanguage: string; dataResidency: string; aiEnabled: boolean }, meta?: { ip?: string; userAgent?: string }) {
    const created = await this.prisma.organization.create({ data: { id: randomUUID(), ...data, tenantId: data.tenantId.toLowerCase(), sectors: JSON.stringify(data.sectors), website: data.website || null } });
    await this.audit(actor, "tenant.created", "Organization", created.id, null, created, meta); return created;
  }
  async updateTenant(actor: PlatformSession, id: string, data: Partial<{ name: string; organizationType: string; country: string; sectors: string[]; contactName: string; contactEmail: string; website: string; defaultLanguage: string; dataResidency: string; aiEnabled: boolean }>, meta?: { ip?: string; userAgent?: string }) {
    const old = await this.prisma.organization.findUniqueOrThrow({ where: { id } });
    const { sectors, website, ...rest } = data;
    const updated = await this.prisma.organization.update({ where: { id }, data: { ...rest, ...(sectors ? { sectors: JSON.stringify(sectors) } : {}), ...(website !== undefined ? { website: website || null } : {}) } });
    await this.audit(actor, "tenant.updated", "Organization", id, old, updated, meta); return updated;
  }
  async deleteTenant(actor: PlatformSession, id: string, confirmation: string, meta?: { ip?: string; userAgent?: string }) {
    const old = await this.prisma.organization.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true, projects: true } } } });
    if (confirmation !== old.name) throw new Error("Tenant name confirmation does not match");
    if (old._count.users || old._count.projects) throw new Error("Tenant must have no users or projects before deletion");
    await this.prisma.organization.delete({ where: { id } }); await this.audit(actor, "tenant.deleted", "Organization", id, old, null, meta);
  }
  async createUser(actor: PlatformSession, data: { tenantId: string; email: string; name: string; role: string; status: string; password: string }, meta?: { ip?: string; userAgent?: string }) {
    const created = await this.prisma.user.create({ data: { id: randomUUID(), tenantId: data.tenantId, email: data.email.toLowerCase(), name: data.name, role: data.role, status: data.status, passwordHash: await bcrypt.hash(data.password, 12) } });
    await this.audit(actor, "user.created", "User", created.id, null, { ...created, passwordHash: "[HASHED]" }, meta); return { ...created, passwordHash: undefined };
  }
  async updateUser(actor: PlatformSession, id: string, data: { name?: string; status?: string; role?: string; password?: string }, meta?: { ip?: string; userAgent?: string }) {
    const old = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.user.update({ where: { id }, data: { name: data.name, status: data.status, role: data.role, ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 12) } : {}) } });
    await this.audit(actor, data.password ? "user.password_reset" : "user.updated", "User", id, old, { ...data, password: data.password ? "[RESET]" : undefined }, meta);
    return updated;
  }
  async deleteUser(actor: PlatformSession, id: string, meta?: { ip?: string; userAgent?: string }) { const old = await this.prisma.user.delete({ where: { id } }); await this.audit(actor, "user.deleted", "User", id, old, null, meta); }

  async testConfiguration(actor: PlatformSession, id: string, meta?: { ip?: string; userAgent?: string }) {
    const row = (await this.query<ConfigurationRow>(`SELECT * FROM "PlatformConfiguration" WHERE "id"=$1`, id))[0];
    if (!row) throw new Error("Configuration not found");
    let status = "FAILED", message = "Credentials could not be verified";
    try {
      const secrets = row.secretCiphertext && row.secretIv && row.secretTag ? JSON.parse(this.decrypt({ ciphertext: row.secretCiphertext, iv: row.secretIv, tag: row.secretTag })) as Record<string, string> : {};
      const configuration = JSON.parse(String(row.configurationJson || "{}")) as Record<string, unknown>;
      const result = await testProvider(String(row.category), String(row.provider), configuration, secrets);
      status = result.ok ? "SUCCESS" : "FAILED"; message = result.message;
    } catch (error) { message = error instanceof Error ? error.message : "Connection test failed"; }
    await this.execute(`UPDATE "PlatformConfiguration" SET "lastTestStatus"=$2,"lastTestMessage"=$3,"lastTestedAt"=NOW(),"updatedAt"=NOW() WHERE "id"=$1`, id, status, message.slice(0, 500));
    await this.audit(actor, "configuration.tested", "PlatformConfiguration", id, null, { status, message }, meta); return { status, message };
  }

  async audit(actor: PlatformSession, action: string, entityType: string, entityId: string, oldValue: unknown, newValue: unknown, meta?: { ip?: string; userAgent?: string }) {
    const previous = (await this.query<{ hash: string }>(`SELECT "hash" FROM "PlatformAuditEvent" ORDER BY "createdAt" DESC LIMIT 1`))[0];
    const createdAt = new Date(); const prevHash = previous?.hash ?? "";
    const body = JSON.stringify({ actorId: actor.sub, action, entityType, entityId, oldValue, newValue, createdAt: createdAt.toISOString(), prevHash });
    const id = randomUUID(); await this.execute(`INSERT INTO "PlatformAuditEvent" ("id","actorId","action","entityType","entityId","oldValue","newValue","ipAddress","userAgent","prevHash","hash","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, id, actor.sub, action, entityType, entityId, oldValue == null ? null : JSON.stringify(oldValue), newValue == null ? null : JSON.stringify(newValue), meta?.ip ?? null, meta?.userAgent ?? null, prevHash, hash(body), createdAt); return { id };
  }
  listAudit() { return this.query(`SELECT * FROM "PlatformAuditEvent" ORDER BY "createdAt" DESC LIMIT 250`); }

  private sign(admin: { id: string; email: string }, purpose: PlatformSession["purpose"], ttl: number) { return jwt.sign({ sub: admin.id, email: admin.email, role: "SUPER_ADMIN", purpose }, this.jwtSecret, { algorithm: "HS256", issuer: "donordesk-superadmin", audience: "donordesk-superadmin", expiresIn: ttl }); }
  private verify(token: string, purpose: PlatformSession["purpose"]): PlatformSession { const value = jwt.verify(token, this.jwtSecret, { algorithms: ["HS256"], issuer: "donordesk-superadmin", audience: "donordesk-superadmin" }) as PlatformSession; if (value.role !== "SUPER_ADMIN" || value.purpose !== purpose) throw new Error("Invalid SuperAdmin session"); return value; }
  private async adminById(id: string) { const row = (await this.query<AdminRow>(`SELECT * FROM "PlatformAdmin" WHERE "id"=$1 LIMIT 1`, id))[0]; if (!row) throw new Error("Platform administrator not found"); return row; }
  private query<T = Record<string, unknown>>(sql: string, ...values: unknown[]) { return this.prisma.$queryRawUnsafe<T[]>(sql, ...values); }
  private execute(sql: string, ...values: unknown[]) { return this.prisma.$executeRawUnsafe(sql, ...values); }
  private encryptString(value: string) { const e = this.encrypt(value); return `${e.iv}.${e.tag}.${e.ciphertext}`; }
  private decryptString(value: string) { const [iv, tag, ciphertext] = value.split("."); if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted value"); const d = createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(iv, "base64")); d.setAuthTag(Buffer.from(tag, "base64")); return Buffer.concat([d.update(Buffer.from(ciphertext, "base64")), d.final()]).toString(); }
  private decrypt(value: { ciphertext: string; iv: string; tag: string }) { const d = createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(value.iv, "base64")); d.setAuthTag(Buffer.from(value.tag, "base64")); return Buffer.concat([d.update(Buffer.from(value.ciphertext, "base64")), d.final()]).toString(); }
  private encrypt(value: string) { const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", this.masterKey, iv); const encrypted = Buffer.concat([c.update(value), c.final()]); return { ciphertext: encrypted.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") }; }
}

function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(input: Buffer) { let bits = ""; for (const byte of input) bits += byte.toString(2).padStart(8, "0"); let out = ""; for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)]; return out; }
function decode32(value: string) { let bits = ""; for (const char of value.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0"); return Buffer.from((bits.match(/.{8}/g) ?? []).map(x => parseInt(x, 2))); }
function verifyTotp(secret: string, code: string) { if (!/^\d{6}$/.test(code)) return false; const step = Math.floor(Date.now() / 30_000); for (let drift = -1; drift <= 1; drift++) { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(step + drift)); const h = createHmac("sha1", decode32(secret)).update(b).digest(); const o = h[19]! & 15; const expected = String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0"); if (timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return true; } return false; }

async function testProvider(category: string, provider: string, config: Record<string, unknown>, secrets: Record<string, string>) {
  let url = "", headers: Record<string, string> = {};
  if (category === "LLM") {
    const defaults: Record<string, string> = { openai: "https://api.openai.com/v1/models", anthropic: "https://api.anthropic.com/v1/models", deepseek: "https://api.deepseek.com/models", minimax: "https://api.minimax.io/v1/models" };
    url = String(config.testUrl || defaults[provider] || ""); const key = secrets.apiKey;
    if (!key) throw new Error("API key is required");
    headers = provider === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : { authorization: `Bearer ${key}` };
  } else if (category === "EMAIL" && provider === "brevo") { url = "https://api.brevo.com/v3/account"; headers = { "api-key": secrets.apiKey || "" }; }
  else if (category === "EMAIL" && provider === "resend") { url = "https://api.resend.com/domains"; headers = { authorization: `Bearer ${secrets.apiKey || ""}` }; }
  else if (category === "EMAIL" && provider === "postmark") { url = "https://api.postmarkapp.com/server"; headers = { "X-Postmark-Server-Token": secrets.serverToken || "" }; }
  else return { ok: Boolean(Object.keys(secrets).length), message: Object.keys(secrets).length ? "Credentials encrypted and configuration validated; live protocol test is performed by its worker adapter" : "No credentials are configured" };
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  return { ok: response.ok, message: response.ok ? "Connection and credentials verified" : `Provider returned HTTP ${response.status}` };
}
