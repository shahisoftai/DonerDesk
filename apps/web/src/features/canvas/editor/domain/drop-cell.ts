/**
 * Where a block dropped from the Add drawer lands (Phase 50.1): the grid cell under the pointer, with the same 12 columns, 5.5rem rows
 * and 12 px gaps the block frame and the marquee use, so a drop and a drawn rectangle agree. Pure; the screen passes the measurements.
 */
export const GRID_COLUMNS = 12;
export const ROW_REM = 5.5;
export const GAP_PX = 12;

export function pointToCell(p: { x: number; y: number }, grid: { left: number; top: number; width: number; offsetWidth: number }, rootFontPx: number): { x: number; y: number } {
  const zoom = grid.offsetWidth > 0 ? grid.width / grid.offsetWidth : 1;
  const colStep = (grid.width + GAP_PX * zoom) / GRID_COLUMNS;
  const rowStep = ROW_REM * rootFontPx * zoom + GAP_PX * zoom;
  const x = Math.min(GRID_COLUMNS - 1, Math.max(0, Math.floor((p.x - grid.left) / colStep)));
  const y = Math.max(0, Math.floor((p.y - grid.top) / rowStep));
  return { x, y };
}
