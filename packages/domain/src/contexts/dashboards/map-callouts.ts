/**
 * Figure cards beside areas of a map, with a line to each area (Phase 50.3d): the province panels of a coordination dashboard,
 * placed by rule instead of by hand. `placeCallouts` is deterministic (same areas, same view -> same places), never lets two cards
 * overlap, keeps every card inside the view, and puts a card it cannot fit beside its area into a column at the side. The screen and
 * a printed file both use these positions, so they agree. Pure.
 */
export interface CalloutAnchor { key: string; x: number; y: number }
export interface CalloutBox { key: string; x: number; y: number; w: number; h: number; anchorX: number; anchorY: number; inColumn: boolean }
export const MAX_CALLOUTS = 12;

/** The eight places around an anchor, tried in this order: right, left, above, below, then the corners. */
const OFFSETS: ReadonlyArray<[number, number]> = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, gap: number): boolean =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

export function placeCallouts(anchors: readonly CalloutAnchor[], view: { w: number; h: number }, card: { w: number; h: number }, opts: { distance?: number; gap?: number } = {}): CalloutBox[] {
  const distance = opts.distance ?? 24, gap = opts.gap ?? 6;
  const placed: CalloutBox[] = [];
  const spill: CalloutAnchor[] = [];
  // Top to bottom, then left to right, so a change elsewhere on the map does not reshuffle every card.
  const order = [...anchors].slice(0, MAX_CALLOUTS).sort((a, b) => a.y - b.y || a.x - b.x || a.key.localeCompare(b.key));
  for (const a of order) {
    let done = false;
    for (const [dx, dy] of OFFSETS) {
      const x = dx === 0 ? a.x - card.w / 2 : dx > 0 ? a.x + distance : a.x - distance - card.w;
      const y = dy === 0 ? a.y - card.h / 2 : dy > 0 ? a.y + distance : a.y - distance - card.h;
      const box = { x: Math.round(x), y: Math.round(y), w: card.w, h: card.h };
      if (box.x < 0 || box.y < 0 || box.x + box.w > view.w || box.y + box.h > view.h) continue;
      if (placed.some((p) => overlaps(p, box, gap))) continue;
      placed.push({ key: a.key, ...box, anchorX: a.x, anchorY: a.y, inColumn: false });
      done = true;
      break;
    }
    if (!done) spill.push(a);
  }
  // Cards that would not fit beside their area stack down the side further from them, still joined by a line.
  let leftY = 0, rightY = 0;
  for (const a of spill) {
    const right = a.x < view.w / 2;
    const x = right ? view.w - card.w : 0;
    let y = right ? rightY : leftY;
    while (placed.some((p) => overlaps(p, { x, y, w: card.w, h: card.h }, gap)) && y + card.h <= view.h) y += card.h + gap;
    placed.push({ key: a.key, x, y, w: card.w, h: card.h, anchorX: a.x, anchorY: a.y, inColumn: true });
    if (right) rightY = y + card.h + gap; else leftY = y + card.h + gap;
  }
  return placed;
}
