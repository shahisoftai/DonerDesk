import type { Metadata } from "next";
import { readPublicCanvas } from "@/lib/server/public-canvas";
import { PublicCanvasView } from "@/features/canvas/presentation/PublicCanvasView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Canvas", robots: { index: false, follow: false } };

/** The same read-only canvas with no heading or page chrome, for placing inside another page with an iframe. A kept copy is a file, so it is offered as a link instead. */
export default async function EmbeddedCanvasPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await readPublicCanvas(token);
  if (!shared) return <p className="p-4 text-center text-sm text-slate-500">This link is not available.</p>;
  if (shared.kind === "FROZEN") return <p className="p-4 text-center text-sm"><a className="underline" href={`/api/shared/canvas/${encodeURIComponent(token)}/file`}>Open {shared.title}</a></p>;
  return <div className="p-2"><PublicCanvasView canvas={shared.canvas} drawings={shared.drawings} models={shared.models} /></div>;
}
