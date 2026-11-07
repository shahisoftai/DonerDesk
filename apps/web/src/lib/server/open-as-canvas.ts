import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

/**
 * The older dashboard and infographic addresses now open the same page as a canvas (made once; the original is never changed). A route, not a page,
 * so the redirect is a plain HTTP one. When the page cannot be opened as a canvas the person lands on Visuals with the reason in the address.
 */
export async function redirectToCanvas(request: Request, kind: "dashboard" | "infographic", sourceId: string): Promise<Response> {
  const home = new URL("/visuals", request.url);
  const token = await getSessionToken();
  if (!token) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(new URL(request.url).pathname)}`, request.url));
  try {
    const response = await fetch(`${apiBaseUrl()}/v1/canvases/from-${kind}/${encodeURIComponent(sourceId)}`, { method: "POST", headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) { home.searchParams.set("notice", "That page could not be opened here."); return NextResponse.redirect(home); }
    const body = (await response.json()) as { canvas?: { id?: string } };
    return NextResponse.redirect(body.canvas?.id ? new URL(`/visuals/${body.canvas.id}`, request.url) : home);
  } catch {
    return NextResponse.redirect(home);
  }
}
