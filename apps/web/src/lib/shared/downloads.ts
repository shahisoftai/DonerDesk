/**
 * Builds a same-origin BFF link for a protected file. The backend returns
 * storage URLs like `/v1/files/{tenantId/.../file.ext}`; the BFF route
 * `/api/files/[...key]` proxies the download using the httpOnly session cookie.
 * Returns the input unchanged when it is not a protected storage path.
 */
export function protectedFileDownloadHref(fileUrl: string, name?: string): string {
  if (!fileUrl.startsWith("/v1/files/")) return fileUrl;
  const decoded = decodeURIComponent(fileUrl.slice("/v1/files/".length));
  const base = `/api/files/${decoded.split("/").map(encodeURIComponent).join("/")}`;
  return name ? `${base}?name=${encodeURIComponent(name)}` : base;
}
