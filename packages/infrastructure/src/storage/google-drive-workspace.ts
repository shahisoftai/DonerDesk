import { DomainError } from "@donordesk/domain";
import type { TenantId, Result } from "@donordesk/domain";
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
