import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";
export function GET() { return relativeRedirect("/visuals/assets?project=portfolio"); }
