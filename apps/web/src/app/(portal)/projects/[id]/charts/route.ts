import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";
/** The Chart Studio is the Visual Studio's Charts tab. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return relativeRedirect(`/visuals/charts/${encodeURIComponent(id)}`);
}
