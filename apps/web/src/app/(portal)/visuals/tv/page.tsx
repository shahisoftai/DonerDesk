import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { CanvasListSchema, CanvasSchema, ResolvedCanvasSchema } from "@/lib/server/schemas-canvas";
import { InlineError } from "@/components/feedback/PageState";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { TvPlaylist, type TvItem } from "@/features/canvas/presentation/TvPlaylist";
import { DEFAULT_SECONDS, MAX_PLAYLIST, MAX_SECONDS, MIN_SECONDS, parsePlaylist, secondsOf } from "@/features/canvas/domain/playlist";

export const dynamic = "force-dynamic";

/** A playlist on a wall screen: the chosen canvases one after another, read as the signed-in person. With no choice yet, a plain list to choose from. */
export default async function VisualTvPage({ searchParams }: { searchParams: Promise<{ ids?: string; pick?: string | string[]; every?: string }> }) {
  const { ids, pick, every } = await searchParams;
  const ctx = await requireSession();
  // A link carries `ids` (a comma list); the chooser below sends one `pick` per ticked box.
  const chosen = parsePlaylist(ids ?? (Array.isArray(pick) ? pick.join(",") : pick));
  if (chosen.length > 0) {
    const loaded = await Promise.all(chosen.map(async (id): Promise<TvItem | null> => {
      const [canvas, resolved] = await Promise.all([
        gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}`, CanvasSchema, ctx.token),
        gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}/resolve`, ResolvedCanvasSchema, ctx.token),
      ]);
      if (!canvas.ok || !resolved.ok) return null;
      return { id, title: canvas.value.title, canvas: canvas.value.canvas, drawings: resolved.value.drawings, models: resolved.value.models };
    }));
    const items = loaded.filter((x): x is TvItem => x !== null);
    if (items.length > 0) return <TvPlaylist items={items} seconds={secondsOf(every)} exitHref="/visuals/tv" />;
  }
  const list = await gatewayRequest("/v1/canvases", CanvasListSchema, ctx.token);
  if (!list.ok) return <InlineError title={list.error.message} referenceId={list.error.referenceId} />;
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Visual Studio</h1>
      <ShellTabs active="tv" />
      <p className="max-w-3xl text-sm text-slate-500">Show dashboards one after another on a wall screen. Choose up to {MAX_PLAYLIST}. The screen refreshes its figures every five minutes and shows only what you can see.{chosen.length > 0 ? " Some of the ones you chose could not be opened." : ""}</p>
      {list.value.length === 0 ? <p className="text-sm text-slate-500">Nothing to show yet.</p> : (
        <form method="get" action="/visuals/tv" className="space-y-3">
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {list.value.map((c) => (
              <li key={c.id} className="p-3"><label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4" name="pick" value={c.id} /> <span className="font-medium">{c.title}</span></label></li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">Seconds on each<input name="every" type="number" min={MIN_SECONDS} max={MAX_SECONDS} defaultValue={DEFAULT_SECONDS} className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" /></label>
            <button type="submit" className="rounded bg-sky-700 px-3 py-2 font-medium text-white hover:bg-sky-800">Start the playlist</button>
          </div>
        </form>
      )}
    </div>
  );
}
