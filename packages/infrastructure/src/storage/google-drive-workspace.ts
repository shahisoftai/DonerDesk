import { DomainError } from "@donordesk/domain";
import type { TenantId, Result } from "@donordesk/domain";
import type { DriveFileEntry } from "@donordesk/application";
import type { GoogleDriveStorageConfig, GoogleDriveAccessTokenStore } from "./google-drive.js";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function fail(message: string): Result<never, DomainError> {
  return { ok: false, error: new DomainError("INVARIANT_VIOLATION", message) };
}

interface DriveFolder {
  id: string;
  webViewLink?: string;
}

/**
 * Low-level Google Drive folder operations for the workspace service. Uses the
 * same per-tenant OAuth token store as evidence storage and grants the
 * DonorDesk service account read access to the tree. Every operation is
 * idempotent: lookup by stable appProperties before create.
 */
export class GoogleDriveWorkspaceDrive {
  constructor(private readonly tokens: GoogleDriveAccessTokenStore) {}

  async ensureRoot(tenantId: TenantId): Promise<Result<{ id: string; deepLink?: string }, DomainError>> {
    const config = await this.tokens.getAccessToken(tenantId.toString());
    if (!config) return fail("Google Drive is not connected for this tenant");

    const found = await this.findByAppProperty(config, tenantId.toString(), undefined, "TENANT_ROOT");
    if (found) return ok({ id: found.id, deepLink: found.webViewLink });

    const created = await this.createFolder(config, {
      name: "DonorDesk",
      parentId: undefined,
      tenantId: tenantId.toString(),
      projectId: undefined,
      role: "TENANT_ROOT",
    });
    return created;
  }

  async ensureFolder(input: {
    parentId: string;
    name: string;
    role: string;
    tenantId: string;
    projectId: string;
  }): Promise<Result<{ id: string }, DomainError>> {
    const config = await this.tokens.getAccessToken(input.tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");

    const found = await this.findByAppProperty(config, input.tenantId, input.projectId, input.role);
    if (found) return ok({ id: found.id });

    const created = await this.createFolder(config, {
      name: input.name,
      parentId: input.parentId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      role: input.role,
    });
    return created;
  }

  /** A folder under the tenant's root that belongs to no project (found by its stable identity, else created). */
  async ensureTenantFolder(input: { tenantId: string; parentId: string; name: string; role: string }): Promise<Result<{ id: string }, DomainError>> {
    const config = await this.tokens.getAccessToken(input.tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");
    const found = await this.findByAppProperty(config, input.tenantId, undefined, input.role);
    if (found) return ok({ id: found.id });
    return this.createFolder(config, { name: input.name, parentId: input.parentId, tenantId: input.tenantId, projectId: undefined, role: input.role });
  }

  /** Saves bytes as a new file in a folder of the tenant's own Drive. Nothing is kept anywhere else. */
  async uploadFile(input: { tenantId: string; parentId: string; name: string; mimeType: string; bytes: Buffer; role: string }): Promise<Result<{ id: string; webViewLink?: string }, DomainError>> {
    const config = await this.tokens.getAccessToken(input.tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");
    try {
      const accessToken = await this.refreshAccessToken(config);
      const boundary = `dd${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      const metadata = JSON.stringify({ name: input.name, parents: [input.parentId], appProperties: { tenantId: input.tenantId, role: input.role } });
      const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`);
      const body = Buffer.concat([head, input.bytes, Buffer.from(`\r\n--${boundary}--`)]);
      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
      if (!response.ok) throw new Error(`Google Drive file upload failed (${response.status})`);
      return ok((await response.json()) as { id: string; webViewLink?: string });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive file upload failed");
    }
  }

  /** The folders a file sits in, and its link. */
  async fileInfo(tenantId: string, fileId: string): Promise<Result<{ name?: string; parents: string[]; webViewLink?: string; trashed: boolean }, DomainError>> {
    const config = await this.tokens.getAccessToken(tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");
    try {
      const accessToken = await this.refreshAccessToken(config);
      const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=name,parents,webViewLink,trashed&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Google Drive file lookup failed (${response.status})`);
      const data = (await response.json()) as { name?: string; parents?: string[]; webViewLink?: string; trashed?: boolean };
      return ok({ ...(data.name ? { name: data.name } : {}), parents: data.parents ?? [], ...(data.webViewLink ? { webViewLink: data.webViewLink } : {}), trashed: data.trashed === true });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive file lookup failed");
    }
  }

  /** Moves a file to another folder (its current folders are replaced). A file already only there stays there. */
  async moveFile(tenantId: string, fileId: string, toFolderId: string): Promise<Result<void, DomainError>> {
    const info = await this.fileInfo(tenantId, fileId);
    if (!info.ok) return info;
    if (info.value.parents.length === 1 && info.value.parents[0] === toFolderId) return ok(undefined);
    const config = await this.tokens.getAccessToken(tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");
    try {
      const accessToken = await this.refreshAccessToken(config);
      const remove = info.value.parents.filter((p) => p !== toFolderId);
      const params = new URLSearchParams({ addParents: toFolderId, supportsAllDrives: "true", fields: "id" });
      if (remove.length > 0) params.set("removeParents", remove.join(","));
      const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params.toString()}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error(`Google Drive move failed (${response.status})`);
      return ok(undefined);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive move failed");
    }
  }

  /** Puts a file in the Drive trash (recoverable by the owner for 30 days). */
  async trashFile(tenantId: string, fileId: string): Promise<Result<void, DomainError>> {
    const config = await this.tokens.getAccessToken(tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");
    try {
      const accessToken = await this.refreshAccessToken(config);
      const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
      if (!response.ok && response.status !== 404) throw new Error(`Google Drive trash failed (${response.status})`);
      return ok(undefined);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive trash failed");
    }
  }

  async verifyAccess(rootId: string): Promise<Result<void, DomainError>> {
    const config = await this.tokens.getAccessToken("");
    if (!config) return ok(undefined); // no tokens -> cannot verify, treat as ok (best-effort)
    try {
      const accessToken = await this.refreshAccessToken(config);
      const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(rootId)}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return fail(`Google Drive access verification failed (${response.status})`);
      const file = (await response.json()) as { trashed?: boolean };
      if (file.trashed) return fail("Google Drive workspace folder was trashed");
      return ok(undefined);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive access verification failed");
    }
  }

  /** Lists non-folder files inside a Drive folder (idempotent, no network on config miss). */
  async listFiles(tenantId: string, folderId: string): Promise<Result<DriveFileEntry[], DomainError>> {
    const config = await this.tokens.getAccessToken(tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");
    try {
      const accessToken = await this.refreshAccessToken(config);
      const q = encodeURIComponent(`'${this.escape(folderId)}' in parents and trashed=false`);
      const response = await fetch(
        `${DRIVE_API}/files?q=${q}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) throw new Error(`Google Drive file list failed (${response.status})`);
      const data = (await response.json()) as {
        files?: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; webViewLink?: string }>;
      };
      return ok(
        (data.files ?? [])
          .filter((f) => f.mimeType !== FOLDER_MIME)
          .map((f) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size !== undefined ? Number(f.size) : undefined,
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink,
          })),
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive file list failed");
    }
  }

  private async findByAppProperty(
    config: GoogleDriveStorageConfig,
    tenantId: string,
    projectId: string | undefined,
    role: string,
  ): Promise<DriveFolder | null> {
    try {
      const accessToken = await this.refreshAccessToken(config);
      const q = [
        `mimeType='${FOLDER_MIME}'`,
        `trashed=false`,
        `appProperties has { key='tenantId' and value='${this.escape(tenantId)}' }`,
        `appProperties has { key='role' and value='${this.escape(role)}' }`,
      ];
      if (projectId) q.push(`appProperties has { key='projectId' and value='${this.escape(projectId)}' }`);
      const query = encodeURIComponent(q.join(" and "));
      const response = await fetch(
        `${DRIVE_API}/files?q=${query}&fields=files(id,webViewLink)&pageSize=10&includeItemsFromAllDrives=true&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) throw new Error(`Google Drive folder lookup failed (${response.status})`);
      const data = (await response.json()) as { files?: DriveFolder[] };
      return data.files?.[0] ?? null;
    } catch {
      return null;
    }
  }

  private async createFolder(
    config: GoogleDriveStorageConfig,
    input: {
      name: string;
      parentId: string | undefined;
      tenantId: string;
      projectId: string | undefined;
      role: string;
    },
  ): Promise<Result<{ id: string; deepLink?: string }, DomainError>> {
    try {
      const accessToken = await this.refreshAccessToken(config);
      const appProperties: Record<string, string> = {
        tenantId: input.tenantId,
        role: input.role,
      };
      if (input.projectId) appProperties.projectId = input.projectId;

      const body: Record<string, unknown> = {
        name: input.name,
        mimeType: FOLDER_MIME,
        appProperties,
      };
      if (input.parentId) body.parents = [input.parentId];

      const response = await fetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        // 409 already-exists: re-run the lookup so retries reconcile.
        if (response.status === 409) {
          const existing = await this.findByAppProperty(config, input.tenantId, input.projectId, input.role);
          if (existing) return ok({ id: existing.id, deepLink: existing.webViewLink });
        }
        throw new Error(`Google Drive folder create failed (${response.status})`);
      }
      const file = (await response.json()) as DriveFolder;
      // Grant the DonorDesk service account read access so the tree can be
      // traversed for OCR / export without the end user's presence.
      if (config.shareEmail) {
        await this.grantReadAccess(accessToken, file.id, config.shareEmail);
      }
      return ok({ id: file.id, deepLink: file.webViewLink });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive folder create failed");
    }
  }

  private async refreshAccessToken(config: GoogleDriveStorageConfig): Promise<string> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) throw new Error(`Google OAuth refresh failed (${response.status})`);
    const data = (await response.json()) as { access_token: string };
    if (!data.access_token) throw new Error("Google OAuth response missing access_token");
    return data.access_token;
  }

  private async grantReadAccess(accessToken: string, fileId: string, email: string): Promise<void> {
    const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "user", emailAddress: email }),
    });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Google Drive permission grant failed (${response.status})`);
    }
  }

  private escape(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
}
