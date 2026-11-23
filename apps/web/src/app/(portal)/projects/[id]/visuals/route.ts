import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";
/** The project's visuals are the Visual Studio's library, filtered to this project. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return relativeRedirect(`/visuals/assets?project=${encodeURIComponent(id)}`);
}
