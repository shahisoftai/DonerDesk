import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";
/** Dashboards are made in Visuals now (one editor for dashboards and infographics). */
export function GET() { return relativeRedirect("/visuals"); }
