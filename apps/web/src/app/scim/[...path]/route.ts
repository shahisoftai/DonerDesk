import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/**
 * The SCIM endpoint, reached from the internet by an identity provider.
 *
 * The API holds the SCIM contract and authenticates the credential itself,
 * so the Authorization header is passed straight through and no session is
 * involved: a SCIM client is not a signed-in person. The discovery
 * endpoints (/scim/v2/ServiceProviderConfig, /scim/v2/ResourceTypes and
 * /scim/v2/Schemas) travel the same way, as the standard requires.
 */
async function forward(request: Request, method: "GET" | "POST" | "PUT" | "DELETE", path: string[]): Promise<Response> {
  const upstream = await fetch(`${apiBaseUrl()}/scim/${path.map(encodeURIComponent).join("/")}`, {
    method,
    headers: {
      authorization: request.headers.get("authorization") ?? "",
      "content-type": request.headers.get("content-type") ?? "application/json",
      accept: request.headers.get("accept") ?? "application/json",
    },
    body: method === "GET" || method === "DELETE" ? undefined : await request.text(),
    cache: "no-store",
  });

  const headers: Record<string, string> = { "cache-control": "private, no-store" };
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, "GET", path);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, "POST", path);
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, "PUT", path);
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, "DELETE", path);
}
