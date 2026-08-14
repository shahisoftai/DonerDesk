/**
 * Builds a same-origin BFF link for a protected file. The backend returns
 * storage URLs like `/v1/files/{tenantId/.../file.ext}`; the BFF route
 * `/api/files/[...key]` proxies the download using the httpOnly session cookie.
 * Non-protected URLs (e.g. Google Drive web links) are returned unchanged.
 */
export function protectedFileDownloadHref(fileUrl: string, name?: string): string {
  if (!fileUrl.startsWith("/v1/files/")) return fileUrl;
  const decoded = decodeURIComponent(fileUrl.slice("/v1/files/".length));
  const base = `/api/files/${decoded.split("/").map(encodeURIComponent).join("/")}`;
  return name ? `${base}?name=${encodeURIComponent(name)}` : base;
}

/**
 * Whether an evidence file is stored in DonorDesk's byte storage (LOCAL/R2) and
 * therefore proxied through the protected `/api/files` BFF route. Google Drive
 * evidence is referenced in the tenant's Drive and opened via its web link.
 */
export function isByteStoredEvidence(storageProvider: string | undefined, fileUrl: string): boolean {
  if (storageProvider === "GOOGLE_DRIVE") return false;
  return fileUrl.startsWith("/v1/files/");
}
