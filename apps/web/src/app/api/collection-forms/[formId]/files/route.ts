import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** A team member attaching a photo or document to an answer: forwarded with their session. */
export async function POST(request: NextRequest, context: { params: Promise<{ formId: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { formId } = await context.params;
  if (Number(request.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return Response.json({ title: "That file is larger than 5 MB." }, { status: 413 });
  try {
    const upstream = await fetch(`${apiBaseUrl()}/v1/collection-forms/${encodeURIComponent(formId)}/files`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": request.headers.get("content-type") ?? "" }, body: await request.arrayBuffer(), cache: "no-store",
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ title: "Service unavailable" }, { status: 502 });
  }
}
