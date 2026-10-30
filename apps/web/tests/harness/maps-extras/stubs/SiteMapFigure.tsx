// Stand-in for the ECharts figure: one line per dot, so the checks read what would be drawn.
export function SiteMapFigure({ points }: { points: ReadonlyArray<{ name: string; items: unknown[] }> }) {
  return <ul data-testid="dots">{points.map((p) => <li key={p.name}>{p.name}:{p.items.length}</li>)}</ul>;
}
