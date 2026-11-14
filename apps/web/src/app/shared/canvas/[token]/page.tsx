import type { Metadata } from "next";
import { readPublicCanvas } from "@/lib/server/public-canvas";
import { PublicCanvasView } from "@/features/canvas/presentation/PublicCanvasView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared canvas", robots: { index: false, follow: false } };

/** What a person with a canvas link sees. No sign-in; the link is the credential. A live link is drawn when it opens; a kept copy is a file. */
export default async function SharedCanvasPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await readPublicCanvas(token);
  if (!shared) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="page-title">This link is not available</h1>
        <p className="mt-2 text-sm text-slate-500">It may have expired or been withdrawn. Ask the person who sent it for a new one.</p>
      </main>
    );
  }
  if (shared.kind === "FROZEN") {
    const file = `/api/shared/canvas/${encodeURIComponent(token)}/file`;
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">{shared.title}</h1>
        <p className="mt-1 text-xs text-slate-500">A copy that was kept on purpose. It does not change when the figures do.</p>
        <p className="mt-4"><a className="rounded bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800" href={file}>Open the file</a></p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">{shared.title}</h1>
      <p className="mt-1 text-xs text-slate-500">Read-only. The figures are drawn from the records each time this page opens. Money, budgets, people and lists of projects are not shown.</p>
      <div className="mt-4"><PublicCanvasView canvas={shared.canvas} drawings={shared.drawings} models={shared.models} choices={shared.choices} token={token} /></div>
    </main>
  );
}
