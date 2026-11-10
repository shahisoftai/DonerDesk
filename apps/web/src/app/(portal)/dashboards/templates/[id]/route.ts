import { relativeRedirect } from "@/lib/server/relative-redirect";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return relativeRedirect(`/visuals/templates/sector/${encodeURIComponent(id)}`);
}
