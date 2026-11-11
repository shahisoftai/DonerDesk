/**
 * Figure cards beside areas of a map, with a line to each area (Phase 50.3d): the province panels of a coordination dashboard,
 * placed by rule instead of by hand. `placeCallouts` is deterministic (same areas, same view -> same places), never lets two cards
 * overlap, keeps every card inside the view, and puts a card it cannot fit beside its area into a column at the side. The screen and
 * a printed file both use these positions, so they agree. Pure.
 */
/** Where a card points (its place, in px). `fixed` is where a person dropped it, relative to that point; `size` overrides the shared card size. */
export interface CalloutAnchor { key: string; x: number; y: number; fixed?: { dx: number; dy: number } | undefined; size?: { w: number; h: number } | undefined }
export interface CalloutBox { key: string; x: number; y: number; w: number; h: number; anchorX: number; anchorY: number; inColumn: boolean; fixed: boolean }
export const MAX_CALLOUTS = 30;
/** How far a person may drop a card from its place (px), so a card can never be lost far off the map. */
export const MAX_CALLOUT_OFFSET = 2000;

/** The eight places around an anchor, tried in this order: right, left, above, below, then the corners. */
const OFFSETS: ReadonlyArray<[number, number]> = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, gap: number): boolean =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

export function placeCallouts(anchors: readonly CalloutAnchor[], view: { w: number; h: number }, card: { w: number; h: number }, opts: { distance?: number; gap?: number } = {}): CalloutBox[] {
  const distance = opts.distance ?? 24, gap = opts.gap ?? 6;
  const list = [...anchors].slice(0, MAX_CALLOUTS);
  // A card a person placed stays exactly where it was dropped (relative to its place); everything else is placed around it.
  const placed: CalloutBox[] = list.filter((a) => a.fixed).map((a) => {
    const size = a.size ?? card;
    // Kept inside the view, so a card dropped at the edge (or left behind by panning) is never lost off the map.
    const x = Math.min(Math.max(0, Math.round(a.x + a.fixed!.dx)), Math.max(0, view.w - size.w)), y = Math.min(Math.max(0, Math.round(a.y + a.fixed!.dy)), Math.max(0, view.h - size.h));
    return { key: a.key, x, y, w: size.w, h: size.h, anchorX: a.x, anchorY: a.y, inColumn: false, fixed: true };
  });
  const spill: CalloutAnchor[] = [];
  // Top to bottom, then left to right, so a change elsewhere on the map does not reshuffle every card.
  const order = list.filter((a) => !a.fixed).sort((a, b) => a.y - b.y || a.x - b.x || a.key.localeCompare(b.key));
  for (const a of order) {
    const size = a.size ?? card;
    let done = false;
    // The nearest free spot to the place: the eight places beside it first (shortest line), then every spot on a 12 px grid, nearest first.
    const candidates: Array<{ x: number; y: number }> = [];
    for (const [dx, dy] of OFFSETS) candidates.push({ x: dx === 0 ? a.x - size.w / 2 : dx > 0 ? a.x + distance : a.x - distance - size.w, y: dy === 0 ? a.y - size.h / 2 : dy > 0 ? a.y + distance : a.y - distance - size.h });
    const step = 12;
    const grid: Array<{ x: number; y: number; d: number }> = [];
    for (let gx = 0; gx + size.w <= view.w; gx += step) for (let gy = 0; gy + size.h <= view.h; gy += step) {
      const cx = gx + size.w / 2, cy = gy + size.h / 2;
      grid.push({ x: gx, y: gy, d: (cx - a.x) ** 2 + (cy - a.y) ** 2 });
    }
    grid.sort((p, q) => p.d - q.d || p.y - q.y || p.x - q.x);
    for (const c of [...candidates, ...grid]) {
      const box = { x: Math.round(c.x), y: Math.round(c.y), w: size.w, h: size.h };
      if (box.x < 0 || box.y < 0 || box.x + box.w > view.w || box.y + box.h > view.h) continue;
      if (placed.some((p) => overlaps(p, box, gap))) continue;
      placed.push({ key: a.key, ...box, anchorX: a.x, anchorY: a.y, inColumn: false, fixed: false });
      done = true;
      break;
    }
    if (!done) spill.push(a);
  }
  // Cards that would not fit near their area stack down the side further from them, still joined by a line.
  let leftY = 0, rightY = 0;
  for (const a of spill) {
    const size = a.size ?? card;
    const right = a.x < view.w / 2;
    const x = right ? view.w - size.w : 0;
    let y = right ? rightY : leftY;
    while (placed.some((p) => overlaps(p, { x, y, w: size.w, h: size.h }, gap)) && y + size.h <= view.h) y += size.h + gap;
    placed.push({ key: a.key, x, y, w: size.w, h: size.h, anchorX: a.x, anchorY: a.y, inColumn: true, fixed: false });
    if (right) rightY = y + size.h + gap; else leftY = y + size.h + gap;
  }
  return placed;
}
