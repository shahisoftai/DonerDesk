import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The whole organisation as a ZIP (administrators only; the API decides). `?files=1` adds the evidence files. Streamed, never buffered. */
export async function GET(request: Request) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const includeFiles = new URL(request.url).searchParams.get("files") === "1";

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/organization/export${includeFiles ? "?files=1" : ""}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const message = upstream.status === 403 ? "Only an administrator can export the organisation." : upstream.status === 409 ? "An export is already being prepared. Try again in a few minutes." : "The export is unavailable.";
    return new Response(message, { status: upstream.status === 403 || upstream.status === 409 ? upstream.status : 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": upstream.headers.get("content-disposition") ?? 'attachment; filename="donordesk-export.zip"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
