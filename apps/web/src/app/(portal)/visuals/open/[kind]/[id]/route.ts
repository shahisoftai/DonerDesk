import { redirectToCanvas } from "@/lib/server/open-as-canvas";
import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";

/** Opens an older dashboard or infographic as a canvas (converted once; the original is never changed). Anything else goes back to the list. */
export async function GET(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await context.params;
  if (kind !== "dashboard" && kind !== "infographic") return relativeRedirect("/visuals");
  return redirectToCanvas(request, kind, id);
}
