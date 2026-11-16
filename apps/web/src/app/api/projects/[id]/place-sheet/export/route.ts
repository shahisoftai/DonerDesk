import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The by-place sheet of one period as Excel (Phase 57): built by the API, forwarded with the session. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const periodId = request.nextUrl.searchParams.get("periodId") ?? "";
  const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/projects/${encodeURIComponent(id)}/place-sheet/export${query}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("Values by place unavailable", { status: upstream.status });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": upstream.headers.get("content-disposition") ?? 'attachment; filename="donordesk-values-by-place.xlsx"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
