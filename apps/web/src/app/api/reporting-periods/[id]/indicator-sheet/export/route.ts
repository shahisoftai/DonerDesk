import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The period's entry sheet as an Excel workbook, fetched with the signed-in person's own session (Phase 34.2). */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/reporting-periods/${encodeURIComponent(id)}/indicator-sheet/export`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("The sheet is unavailable", { status: upstream.status });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="donordesk-indicator-values.xlsx"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
