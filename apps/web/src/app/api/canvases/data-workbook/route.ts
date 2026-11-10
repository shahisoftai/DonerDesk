import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The tables a person is looking at, made into a spreadsheet. The session never leaves the server, and nothing is read from the records here. */
export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  let body: string;
  try { body = JSON.stringify(await request.json()); } catch { return new Response("Bad request", { status: 400 }); }
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/canvases/data-workbook`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  for (const name of ["content-type", "content-disposition"]) { const v = upstream.headers.get(name); if (v) headers.set(name, v); }
  return new Response(upstream.body, { status: upstream.status, headers });
}
