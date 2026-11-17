import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const hxl = request.nextUrl.searchParams.get("format") === "hxl";

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/projects/${encodeURIComponent(id)}/data-sheet/export${hxl ? "?format=hxl" : ""}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("Data sheet unavailable", { status: upstream.status });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": hxl ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": hxl ? 'attachment; filename="donordesk-data-sheet-hxl.csv"' : 'attachment; filename="donordesk-data-sheet.xlsx"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
