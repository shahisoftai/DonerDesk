import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** Every import template (`/api/templates/<kind>`) is built by the API; this forwards the download with the session. */
const KINDS = new Set(["logframe", "indicators", "activities", "evidence", "work-plan", "places", "finance-register"]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.has(kind)) return new Response("Not found", { status: 404 });
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/api/templates/${kind}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("Template unavailable", { status: upstream.status });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="${kind}-template.xlsx"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
