import { NextRequest } from "next/server";
import { proxyGeoDownload } from "@/lib/server/geo-download";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const q = request.nextUrl.searchParams;
  const out = new URLSearchParams({ format: q.get("format") === "csv" ? "csv" : "geojson", level: q.get("level") ?? "1", indicatorId: q.get("indicatorId") ?? "" });
  const period = q.get("periodId");
  if (period) out.set("periodId", period);
  return proxyGeoDownload(`/v1/projects/${encodeURIComponent(id)}/place-results/export?${out}`);
}
