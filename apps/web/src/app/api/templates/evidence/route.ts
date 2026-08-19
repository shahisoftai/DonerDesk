import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/evidence/template`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response("Template unavailable", { status: upstream.status });
  }

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="evidence-template.xlsx"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
