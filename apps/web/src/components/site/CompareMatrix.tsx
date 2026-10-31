"use client";

import { useMemo, useState } from "react";
import { SECTIONS, VENDORS, type Cell, type Level, type VendorId } from "./compare-data";

const MARK: Record<Level, { symbol: string; label: string; className: string }> = {
  yes: { symbol: "✓", label: "Stated", className: "sx-lv-yes" },
  partial: { symbol: "~", label: "Partly", className: "sx-lv-partial" },
  no: { symbol: "✕", label: "Not offered", className: "sx-lv-no" },
  unknown: { symbol: "✕", label: "Not stated", className: "sx-lv-unknown" },
};

function CellView({ cell }: { cell: Cell }) {
  const m = MARK[cell.level];
  return (
    <>
      <span className={`sx-lv ${m.className}`} title={m.label}><span aria-hidden="true">{m.symbol}</span><span className="sx-sr"> {m.label}: </span></span>
      <span>{cell.text}</span>
    </>
  );
}

/** The feature-by-feature matrix. The visitor picks which tools to set beside DonorDesk; DonorDesk is always shown. */
export function CompareMatrix() {
  const others = VENDORS.filter((v) => v.id !== "dd");
  const [chosen, setChosen] = useState<Set<VendorId>>(new Set(others.map((v) => v.id)));
  const shown = useMemo(() => VENDORS.filter((v) => v.id === "dd" || chosen.has(v.id)), [chosen]);

  function toggle(id: VendorId) {
    setChosen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="sx-cmp-controls" data-no-print>
        <div>
          <b>Set DonorDesk beside</b>
          <div className="sx-chips" role="group" aria-label="Choose tools to compare" style={{ marginTop: 8 }}>
            {others.map((v) => <button key={v.id} type="button" className="sx-chip" aria-pressed={chosen.has(v.id)} onClick={() => toggle(v.id)}>{v.name}</button>)}
          </div>
        </div>
        <ul className="sx-key" aria-label="Key">
          {(Object.keys(MARK) as Level[]).map((l) => <li key={l}><span className={`sx-lv ${MARK[l].className}`} aria-hidden="true">{MARK[l].symbol}</span> {MARK[l].label}{l === "unknown" ? " (we did not find it on the pages we read; it may still exist)" : l === "yes" ? " by the vendor, or done today by DonorDesk" : ""}</li>)}
        </ul>
        <nav aria-label="Jump to a section" className="sx-jump">
          {SECTIONS.map((s) => <a key={s.id} href={`#cmp-${s.id}`}>{s.title}</a>)}
        </nav>
      </div>

      <div className="sx-cmp-wrap" tabIndex={0} aria-label="Feature comparison table, scrolls sideways on small screens">
        <table className="sx-cmp">
          <thead>
            <tr>
              <th scope="col"><span className="sx-sr">Feature</span></th>
              {shown.map((v) => <th key={v.id} scope="col" className={v.id === "dd" ? "sx-us" : undefined}>{v.name}</th>)}
            </tr>
          </thead>
          {SECTIONS.map((s) => (
            <tbody key={s.id} id={`cmp-${s.id}`}>
              <tr className="sx-sec-row"><th colSpan={shown.length + 1} scope="colgroup">{s.title}<small>{s.intro}</small></th></tr>
              {s.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {shown.map((v) => <td key={v.id} className={v.id === "dd" ? "sx-us" : undefined}><CellView cell={r.cells[v.id]} /></td>)}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
