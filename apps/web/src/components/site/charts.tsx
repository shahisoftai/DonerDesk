import { MONTHS, type SectorExample } from "./site-data";

/** Small SVG charts for the public site. Example data only; drawn from the same numbers as the labels beside them. */

const MAP_POSITIONS: Array<[number, number]> = [[70, 52], [128, 78], [52, 110], [118, 128], [150, 40]];
const DONUT_COLOURS = ["var(--brand)", "#2f8fd0", "var(--accent)", "#8aa6a3", "#c9dcd9"];

export function LineChart({ sector }: { sector: SectorExample }) {
  const W = 300, H = 140, pl = 28, pr = 14, pt = 10, pb = 22;
  const mx = Math.max(...sector.target, ...sector.series) * 1.08;
  const x = (i: number) => pl + (i * (W - pl - pr)) / 5;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / mx);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path(sector.series)} L${x(5)} ${H - pb} L${x(0)} ${H - pb} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Line chart: ${sector.lineTitle}, actual against target`}>
      {[0, 1, 2, 3].map((g) => {
        const v = (mx * g) / 3.24;
        return (
          <g key={g}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={pl - 5} y={y(v) + 3} textAnchor="end">{v < 10 ? String(Number(v.toFixed(1))) : Math.round(v)}</text>
          </g>
        );
      })}
      {MONTHS.map((m, i) => <text key={m} x={x(i)} y={H - 6} textAnchor="middle">{m}</text>)}
      <path d={area} fill="var(--brand)" opacity=".12" />
      <path d={path(sector.target)} fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="4 4" />
      <path d={path(sector.series)} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(5)} cy={y(sector.series[5]!)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

export function BubbleMap({ sector }: { sector: SectorExample }) {
  const mx = Math.max(...sector.places.map((p) => p[1]));
  return (
    <svg viewBox="0 0 200 160" width="100%" role="img" aria-label={`Schematic map: ${sector.placeLabel} by place`} className="sx-mapbox">
      <path d="M26 60 Q40 20 90 22 T170 30 Q188 70 170 112 T110 148 Q52 150 36 116 T26 60Z" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
      <path d="M60 40q30 20 70 10M50 90q40-14 90 10" stroke="var(--line)" fill="none" strokeDasharray="3 4" />
      {sector.places.map((p, i) => {
        const r = 7 + Math.sqrt(p[1] / mx) * 16;
        const [cx, cy] = MAP_POSITIONS[i]!;
        return (
          <g key={p[0]}>
            <circle cx={cx} cy={cy} r={r.toFixed(1)} fill="var(--brand)" opacity=".72" stroke="var(--surface)" strokeWidth="1.5" />
            <text x={cx} y={cy + r + 10} textAnchor="middle" style={{ stroke: "var(--wash)", strokeWidth: 3, paintOrder: "stroke" }}>{p[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function PlaceBars({ sector }: { sector: SectorExample }) {
  const mx = Math.max(...sector.places.map((p) => p[1]));
  return (
    <svg viewBox="0 0 420 190" width="100%" role="img" aria-label={`Bar chart: ${sector.placeLabel} by place`}>
      {sector.places.map((p, i) => {
        const y = 10 + i * 34, w = (p[1] / mx) * 280;
        return (
          <g key={p[0]}>
            <text x="0" y={y + 15} style={{ fontSize: 12 }}>{p[0]}</text>
            <rect x="90" y={y} width={w} height="22" rx="5" fill="var(--brand)" opacity={1 - i * 0.13} />
            <text x={96 + w} y={y + 15} style={{ fontSize: 12, fill: "var(--ink)" }}>{p[1]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function PlaceDonut({ sector }: { sector: SectorExample }) {
  const total = sector.places.reduce((a, p) => a + p[1], 0);
  const cx = 100, cy = 95, R = 70, r = 44;
  let a0 = -Math.PI / 2;
  const pt = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
  const slices = sector.places.map((p, i) => {
    const a1 = a0 + (p[1] / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M${pt(R, a0)} A${R} ${R} 0 ${large} 1 ${pt(R, a1)} L${pt(r, a1)} A${r} ${r} 0 ${large} 0 ${pt(r, a0)}Z`;
    a0 = a1;
    return <path key={p[0]} d={d} fill={DONUT_COLOURS[i]} stroke="var(--surface)" strokeWidth="2" />;
  });
  return (
    <div className="sx-donut">
      <svg viewBox="0 0 200 190" width="220" role="img" aria-label={`Donut chart: share of ${sector.placeLabel} by place`}>{slices}</svg>
      <ul>
        {sector.places.map((p, i) => (
          <li key={p[0]}><i style={{ background: DONUT_COLOURS[i] }} />{p[0]} · {Math.round((p[1] / total) * 100)}%</li>
        ))}
      </ul>
    </div>
  );
}

export function PlaceTable({ sector }: { sector: SectorExample }) {
  const total = sector.places.reduce((a, p) => a + p[1], 0);
  return (
    <table className="sx-t">
      <thead><tr><th>Place</th><th className="sx-n">{sector.placeLabel}</th><th className="sx-n">Share</th></tr></thead>
      <tbody>{sector.places.map((p) => <tr key={p[0]}><td>{p[0]}</td><td className="sx-n">{p[1]}</td><td className="sx-n">{Math.round((p[1] / total) * 100)}%</td></tr>)}</tbody>
    </table>
  );
}

export function SectorDashboard({ sector }: { sector: SectorExample }) {
  return (
    <>
      <div className="sx-panel-head"><b>{sector.title}</b><span className="sx-tag">Example data</span></div>
      <div className="sx-kpis">
        {sector.kpis.map((k) => {
          const p = Math.max(0, Math.min(100, Math.round((k.value / k.target) * 100)));
          return (
            <div className="sx-kpi" key={k.label}>
              <small>{k.label}</small>
              <strong>{k.percent ? `${k.value}%` : k.value.toLocaleString("en-US")}</strong>
              <div className="sx-bar" aria-hidden="true"><span style={{ width: `${p}%` }} /></div>
            </div>
          );
        })}
      </div>
      <div className="sx-pg">
        <div><h4>{sector.lineTitle}</h4><LineChart sector={sector} /><div className="sx-legend"><span><i />Actual</span><span><i className="sx-t2" />Target</span></div></div>
        <div><h4>By place</h4><BubbleMap sector={sector} /></div>
      </div>
      <div className="sx-panel-foot"><span>{sector.foot}</span><span>Places are schematic</span></div>
    </>
  );
}
