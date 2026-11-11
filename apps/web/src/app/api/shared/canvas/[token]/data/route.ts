import { NextResponse } from "next/server";
import { readPublicCanvas } from "@/lib/server/public-canvas";

export const dynamic = "force-dynamic";

/** The link's page again, narrowed by a period and places the holder chose. The link is the credential; nothing but those two filters is read. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(request.url);
  const periodId = url.searchParams.get("periodId"), places = url.searchParams.get("places");
  const shared = await readPublicCanvas(token, { ...(periodId ? { periodId: periodId.slice(0, 80) } : {}), ...(places ? { places: places.slice(0, 400) } : {}) });
  if (!shared || shared.kind !== "LIVE") return NextResponse.json({ title: "This link is not available" }, { status: 404, headers: { "cache-control": "private, no-store" } });
  return NextResponse.json({ drawings: shared.drawings, models: shared.models, choices: shared.choices }, { headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });
}
