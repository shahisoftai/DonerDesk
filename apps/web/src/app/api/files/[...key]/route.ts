import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "download";
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
  const filename = sanitizeFilename(requestedName ?? "");

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
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
