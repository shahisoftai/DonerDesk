import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The project's management report as a CSV. The API decides whether the signed-in person may see the project. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/projects/${encodeURIComponent(id)}/management-report/export`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("The report is unavailable", { status: upstream.status });
  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": upstream.headers.get("content-disposition") ?? 'attachment; filename="management-report.csv"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
