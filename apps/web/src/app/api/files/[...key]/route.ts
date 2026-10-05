import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

const MAX_FILENAME = 160;

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (cleaned.length <= MAX_FILENAME) return cleaned || "download";
  // Shorten the base, never the extension: a name that loses ".docx" is not a document any more.
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 9 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, MAX_FILENAME - ext.length) + ext;
}

/** Content types for the files the app produces; the stored key's extension is authoritative (the API serves bytes untyped). */
const CONTENT_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return m ? m[1]!.toLowerCase() : "";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
) {
  const token = await getSessionToken();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key } = await context.params;
  const keyPath = key.join("/");
  const encodedKey = encodeURIComponent(keyPath);

  const requestedName = new URL(request.url).searchParams.get("name");
  // Without an explicit name the stored key's own name (…/exports/<id>.docx) keeps the extension, so the file opens in Word/PDF viewers.
  const storedName = keyPath.split("/").pop() ?? "";
  const filename = sanitizeFilename(requestedName || storedName);
  const extension = extensionOf(filename) || extensionOf(storedName);

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/files/${encodedKey}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response("File not found", { status: upstream.status });
  }

  const body = await upstream.arrayBuffer();
  const upstreamType = upstream.headers.get("content-type");
  const contentType = CONTENT_TYPES[extension] ?? (upstreamType && upstreamType !== "application/octet-stream" ? upstreamType : "application/octet-stream");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
