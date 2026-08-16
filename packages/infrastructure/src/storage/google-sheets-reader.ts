import type { ISheetReader } from "@donordesk/application";
import { DomainError, type Result } from "@donordesk/domain";
import type { GoogleDriveAccessTokenStore } from "./google-drive.js";
import { refreshGoogleAccessToken, parseSpreadsheetId } from "./google-oauth.js";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Server-side Google Sheets reader. Uses the tenant's Drive OAuth connection
 * (see GoogleDriveAccessTokenStore) to read cell values from a spreadsheet,
 * returning the raw header + rows grid for mapping in the application layer.
 */
export class GoogleSheetsReader implements ISheetReader {
  constructor(private readonly tokens: GoogleDriveAccessTokenStore) {}

  async readSheet(input: { tenantId: string; sheetUrl: string }): Promise<Result<{ headers: string[]; rows: string[][] }, DomainError>> {
    const config = await this.tokens.getAccessToken(input.tenantId);
    if (!config) {
      return { ok: false, error: DomainError.forbidden("Google Drive is not connected for this workspace") };
    }
    const spreadsheetId = parseSpreadsheetId(input.sheetUrl);
    if (!spreadsheetId) {
      return { ok: false, error: DomainError.validation("Could not read a spreadsheet id from that URL") };
    }

    try {
      const accessToken = await refreshGoogleAccessToken({ clientId: config.clientId, clientSecret: config.clientSecret, refreshToken: config.refreshToken });
      const response = await fetch(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/A1:ZZ1000?majorDimension=ROWS`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const body = await response.text();
        return { ok: false, error: DomainError.validation(`Google Sheets could not be read (${response.status}). Make sure the sheet is shared with the connected account.${body ? ` ${body.slice(0, 300)}` : ""}`) };
      }
      const data = (await response.json()) as { values?: unknown[][] };
      const values = (data.values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
      if (values.length === 0) {
        return { ok: true, value: { headers: [], rows: [] } };
      }
      const headers = values[0] ?? [];
      const rows = values.slice(1);
      return { ok: true, value: { headers, rows } };
    } catch (error) {
      return { ok: false, error: DomainError.validation(error instanceof Error ? error.message : "Google Sheets read failed") };
    }
  }
}
