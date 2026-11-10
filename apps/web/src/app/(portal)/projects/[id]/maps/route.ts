import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";
/** The map explorer is the Visual Studio's Maps tab. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return relativeRedirect(`/visuals/maps/${encodeURIComponent(id)}`);
}
