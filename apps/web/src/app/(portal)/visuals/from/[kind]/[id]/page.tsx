import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ConvertedCanvasSchema } from "@/lib/server/schemas-canvas";
import { InlineError } from "@/components/feedback/PageState";

export const dynamic = "force-dynamic";

/** Opens an older dashboard or infographic as a canvas. Done once: opening it again goes to the same canvas, and the original is never changed. */
export default async function OpenAsCanvasPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== "dashboard" && kind !== "infographic") notFound();
  const ctx = await requireSession();
  const r = await gatewayRequest(`/v1/canvases/from-${kind}/${encodeURIComponent(id)}`, ConvertedCanvasSchema, ctx.token, { method: "POST" });
  if (!r.ok) return <InlineError title={r.error.message} referenceId={r.error.referenceId} />;
  redirect(`/visuals/${r.value.canvas.id}`);
}
