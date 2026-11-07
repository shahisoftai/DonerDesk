import { redirectToCanvas } from "@/lib/server/open-as-canvas";

export const dynamic = "force-dynamic";
/** The older address of a dashboard: it opens as a canvas in Visuals. */
export async function GET(request: Request, context: { params: Promise<Record<string, string>> }) {
  const params = await context.params;
  return redirectToCanvas(request, "dashboard", params.id ?? "");
}
