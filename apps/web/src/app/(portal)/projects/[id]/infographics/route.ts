import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";
/** A project's images, brand kit and saved layouts are in the Visual Studio's Assets tab. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return relativeRedirect(`/visuals/assets?project=${encodeURIComponent(id)}`);
}
