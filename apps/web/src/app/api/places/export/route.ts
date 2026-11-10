import { NextRequest } from "next/server";
import { proxyGeoDownload } from "@/lib/server/geo-download";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "geojson";
  return proxyGeoDownload(`/v1/places/export?format=${format}`);
}
