import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";
/** Sector templates live in the Visual Studio's Templates tab. */
export function GET() { return relativeRedirect("/visuals/templates"); }
