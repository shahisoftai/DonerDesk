import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The cross-project indicator roll-up as a CSV. Only the projects the signed-in person is on are in it; the API decides that. */
export async function GET() {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/portfolio/indicators/export`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("The roll-up is unavailable", { status: upstream.status });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="indicators-across-projects.csv"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
