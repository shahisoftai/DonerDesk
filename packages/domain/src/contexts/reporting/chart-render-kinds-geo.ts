import type { DatasetFlow, DatasetPlace } from "./dataset-query.js";
import { niceUnit } from "./chart-render-kinds.js";

/**
 * Phase 48.12 map kinds drawn from places that have a pin: dot density and a hexagon grid. Both only add values up (counts), both draw
 * only places with a pin and name the ones left off, and neither invents a position: a dot sits at its place, jittered a little so dots
 * do not stack, and a hexagon groups the places whose pins fall inside it. A bivariate map and a flow map are not offered: the first needs
 * two indicators by place and the second needs origin and destination records, which the data does not carry.
 */
export interface GeoKit {
  /** The chart's title, text description and legend, as every kind starts. */
  base: Record<string, unknown>;
  /** The map component (the bundled geography, centred on the pins). */
  geo: Record<string, unknown>;
  palette: string[];
  fmt: (n: number) => string;
  unit: string;
}
export type GeoBuilt = { option: Record<string, unknown>; notes: string[] } | string;

type Pinned = DatasetPlace & { value: number; latitude: number; longitude: number };
const pins = (places: ReadonlyArray<DatasetPlace>): { pinned: Pinned[]; noPin: number } => {
  const withValue = places.filter((p) => p.value !== null && p.value > 0);
  const pinned = withValue.filter((p): p is Pinned => p.latitude !== undefined && p.longitude !== undefined);
  return { pinned, noPin: withValue.length - pinned.length };
};
const leftOff = (noPin: number): string[] => (noPin > 0 ? [`${noPin} ${noPin === 1 ? "place has" : "places have"} a value but no pin, so ${noPin === 1 ? "it is" : "they are"} not on the map.`] : []);

const MAX_DOTS = 400;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** One dot stands for a round number of units; a place's dots sit round its pin on a spiral, and a part of a dot is one fainter dot. */
export function dotDensity(places: ReadonlyArray<DatasetPlace>, kit: GeoKit): GeoBuilt {
  const { pinned, noPin } = pins(places);
  if (pinned.length < 2) return "Dot density needs at least two places with a value and a pin on the map. Pin places in the places list, or use a bar chart.";
  const total = pinned.reduce((t, p) => t + p.value, 0);
  const unit = niceUnit(Math.max(total / (MAX_DOTS / 4), 1e-9));
  const dots: Array<{ value: [number, number]; itemStyle?: { opacity: number }; name: string }> = [];
  for (const p of pinned) {
    const whole = Math.floor(p.value / unit);
    const part = p.value - whole * unit > 0;
    const count = whole + (part ? 1 : 0);
    for (let k = 0; k < count; k += 1) {
      const radius = 0.05 * Math.sqrt(k + 1);
      const angle = k * GOLDEN;
      dots.push({ name: p.name, value: [Number((p.longitude + radius * Math.cos(angle)).toFixed(4)), Number((p.latitude + radius * Math.sin(angle)).toFixed(4))], ...(part && k === count - 1 ? { itemStyle: { opacity: 0.35 } } : {}) });
    }
  }
  return {
    option: { ...kit.base, tooltip: { trigger: "item", formatter: "{b}" }, geo: kit.geo, series: [{ type: "scatter", coordinateSystem: "geo", symbolSize: 6, itemStyle: { color: kit.palette[0] }, data: dots }] },
    notes: [`One dot stands for ${kit.fmt(unit)}${kit.unit ? ` ${kit.unit}` : ""}; an amount less than one dot is one fainter dot. Dots sit round their place's pin, not at the exact spot of each person.`, ...leftOff(noPin)],
  };
}

const HEX_ROWS = 10;
/** Places grouped into hexagons of a size chosen from the spread of the pins; a hexagon shows the sum of its places, an empty one is not drawn. */
export function hexGrid(places: ReadonlyArray<DatasetPlace>, kit: GeoKit): GeoBuilt {
  const all = pins(places);
  if (all.pinned.length < 2) return "A hexagon grid needs at least two places with a value and a pin on the map. Pin places in the places list, or use a bar chart.";
  // A place and the area it sits in are never added together when they can be told apart: the deepest level that has two pins is drawn.
  const deepest = Math.max(...all.pinned.map((p) => p.level));
  const mixed = new Set(all.pinned.map((p) => p.level)).size > 1;
  const deeper = all.pinned.filter((p) => p.level === deepest);
  const pinned = mixed && deeper.length >= 2 ? deeper : all.pinned;
  const noPin = all.noPin;
  const levelNote = mixed ? [deeper.length >= 2 ? `${all.pinned.length - deeper.length} ${all.pinned.length - deeper.length === 1 ? "place is" : "places are"} at a wider level and not drawn, so a place and the area it sits in are never added together.` : "These places are at different levels, so a hexagon may add a place and the area it sits in: read the data at one level for exact sums."] : [];
  const lats = pinned.map((p) => p.latitude), lons = pinned.map((p) => p.longitude);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons), 0.2);
  const size = span / HEX_ROWS; // the hexagon's width in degrees
  const rowStep = size * 0.866;
  const cells = new Map<string, { sum: number; names: string[]; row: number; col: number }>();
  for (const p of pinned) {
    const row = Math.round(p.latitude / rowStep);
    const col = Math.round((p.longitude - (row % 2 === 0 ? 0 : size / 2)) / size);
    const key = `${row}:${col}`;
    const cell = cells.get(key) ?? { sum: 0, names: [], row, col };
    cell.sum += p.value;
    cell.names.push(p.name);
    cells.set(key, cell);
  }
  const drawn = [...cells.values()];
  const max = Math.max(...drawn.map((c) => c.sum));
  const min = Math.min(...drawn.map((c) => c.sum));
  const km = Math.round(size * 111);
  return {
    option: {
      ...kit.base, tooltip: { trigger: "item", formatter: "{b}: {c}" }, geo: kit.geo,
      visualMap: { type: "continuous", min, max: max === min ? min + 1 : max, dimension: 2, calculable: true, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#cfe4f7", kit.palette[0]] } },
      series: [{ type: "scatter", coordinateSystem: "geo", symbol: "path://M12 1 22 6.5v11L12 23 2 17.5v-11z", symbolSize: 28, data: drawn.map((c) => ({ name: c.names.join(", "), value: [Number((c.col * size + (c.row % 2 === 0 ? 0 : size / 2)).toFixed(4)), Number((c.row * rowStep).toFixed(4)), c.sum] })) }],
    },
    notes: [`Places are grouped into hexagons about ${km} km across; each shows the sum of the places whose pins fall inside it (${kit.fmt(min)} to ${kit.fmt(max)}${kit.unit ? ` ${kit.unit}` : ""}). A hexagon with no place in it is not drawn.`, ...leftOff(noPin), ...levelNote],
  };
}

const WORDS = ["low", "middle", "high"] as const;
/** Colours of a 3 by 3 two-variable map: grey where both are low, one hue along each indicator, the strongest where both are high (the standard Stevens palette). */
const BIVARIATE_COLOURS: ReadonlyArray<ReadonlyArray<string>> = [
  ["#e8e8e8", "#ace4e4", "#5ac8c8"],
  ["#dfb0d6", "#a5add3", "#5698b9"],
  ["#be64ac", "#8c62aa", "#3b4994"],
];
const thirds = (values: ReadonlyArray<number>): [number, number] => {
  const sorted = [...values].sort((a, b) => a - b);
  return [sorted[Math.floor(sorted.length / 3)]!, sorted[Math.floor((2 * sorted.length) / 3)]!];
};
const classOf = (v: number, [t1, t2]: [number, number]): 0 | 1 | 2 => (v < t1 ? 0 : v < t2 ? 1 : 2);

/** Two indicators in each pinned place, each split into thirds of the places that have both, so a person sees where both are high or both low. */
export function bivariate(places: ReadonlyArray<DatasetPlace>, second: ReadonlyArray<DatasetPlace>, names: readonly [string, string], kit: GeoKit): GeoBuilt {
  const other = new Map(second.map((p) => [p.path, p]));
  const pinned = places.filter((p): p is DatasetPlace & { value: number; latitude: number; longitude: number } => p.value !== null && p.latitude !== undefined && p.longitude !== undefined);
  const rows = pinned.flatMap((p) => { const b = other.get(p.path)?.value; return b === null || b === undefined ? [] : [{ p, a: p.value, b }]; });
  if (rows.length < 3) return "A two-indicator map needs at least three places that have a value for both indicators and a pin on the map. Pin places in the places list, or draw each indicator on its own.";
  const ta = thirds(rows.map((r) => r.a)), tb = thirds(rows.map((r) => r.b));
  const data = rows.map((r) => { const ca = classOf(r.a, ta), cb = classOf(r.b, tb); return { name: `${r.p.name}: ${kit.fmt(r.a)} and ${kit.fmt(r.b)}`, value: [r.p.longitude, r.p.latitude, cb * 3 + ca] }; });
  const pieces = [0, 1, 2].flatMap((cb) => [0, 1, 2].map((ca) => ({ value: cb * 3 + ca, label: `A ${WORDS[ca]} · B ${WORDS[cb]}`, color: BIVARIATE_COLOURS[cb]![ca]! })));
  const unlabelled = places.filter((p) => p.value !== null).length - rows.length;
  return {
    option: {
      ...kit.base, tooltip: { trigger: "item", formatter: "{b}" }, geo: kit.geo,
      visualMap: { type: "piecewise", dimension: 2, pieces, orient: "horizontal", left: "center", bottom: 0, itemGap: 6, textStyle: { fontSize: 10 } },
      series: [{ type: "scatter", coordinateSystem: "geo", symbolSize: 22, itemStyle: { borderColor: "#fff", borderWidth: 1 }, data }],
    },
    notes: [`A is ${names[0]} and B is ${names[1]}. Each indicator's places are split into thirds (low, middle, high) among the ${rows.length} places that have both, so a colour says where a place stands against the others, not against a target.`, ...(unlabelled > 0 ? [`${unlabelled} ${unlabelled === 1 ? "place has" : "places have"} a value for only one indicator, or no pin, and ${unlabelled === 1 ? "is" : "are"} not on the map.`] : [])],
  };
}

/** What moves between places, as arrows whose width is the quantity, one colour for each kind of thing moved; one unit only, and only flows whose two ends both have a pin. */
export function flowMap(flows: ReadonlyArray<DatasetFlow>, kit: GeoKit): GeoBuilt {
  const pinned = flows.filter((f) => f.fromLatitude !== undefined && f.fromLongitude !== undefined && f.toLatitude !== undefined && f.toLongitude !== undefined && f.quantity > 0);
  if (pinned.length === 0) return flows.length === 0 ? "No movements between places are recorded for this project yet. Add them from the map's Flows list." : "None of the recorded movements has a pin at both ends. Pin the places in the places list.";
  const units = [...new Set(pinned.map((f) => f.unit.trim()))];
  if (units.length > 1) return `The movements use more than one unit (${units.map((u) => u || "none").join(", ")}), so their widths cannot be compared on one map.`;
  const whats = [...new Set(pinned.map((f) => f.what.trim() || "Movement"))];
  const widest = Math.max(...pinned.map((f) => f.quantity));
  const ends = new Map<string, { name: string; value: [number, number]; total: number }>();
  const touch = (name: string, lon: number, lat: number, q: number) => { const e = ends.get(name) ?? { name, value: [lon, lat] as [number, number], total: 0 }; e.total += q; ends.set(name, e); };
  for (const f of pinned) { touch(f.from, f.fromLongitude!, f.fromLatitude!, f.quantity); touch(f.to, f.toLongitude!, f.toLatitude!, f.quantity); }
  const biggest = Math.max(...[...ends.values()].map((e) => e.total));
  const series: unknown[] = whats.map((what, i) => ({
    type: "lines", name: what, coordinateSystem: "geo", zlevel: 2, effect: { show: true, period: 6, trailLength: 0.1, symbol: "arrow", symbolSize: 6 },
    lineStyle: { color: kit.palette[i % kit.palette.length], opacity: 0.7, curveness: 0.2 },
    data: pinned.filter((f) => (f.what.trim() || "Movement") === what).map((f) => ({ name: `${f.from} to ${f.to}: ${kit.fmt(f.quantity)}${units[0] ? ` ${units[0]}` : ""}`, coords: [[f.fromLongitude!, f.fromLatitude!], [f.toLongitude!, f.toLatitude!]], lineStyle: { width: 1 + 9 * (f.quantity / widest) } })),
  }));
  series.push({ type: "scatter", name: "Places", coordinateSystem: "geo", zlevel: 3, itemStyle: { color: "#444" }, tooltip: { formatter: "{b}" }, data: [...ends.values()].map((e) => ({ name: e.name, value: e.value, symbolSize: 6 + 12 * Math.sqrt(e.total / biggest) })) });
  const skipped = flows.length - pinned.length;
  return {
    option: { ...kit.base, tooltip: { trigger: "item", formatter: "{b}" }, legend: { show: true, bottom: 0, data: whats }, geo: kit.geo, series },
    notes: [`Arrow width is the quantity moved${units[0] ? ` (${units[0]})` : ""}; a dot's size is the total through that place. The moving arrows are for the screen: a file shows still arrows.`, ...(skipped > 0 ? [`${skipped} ${skipped === 1 ? "movement has" : "movements have"} an end with no pin, or no quantity, and ${skipped === 1 ? "is" : "are"} not drawn.`] : [])],
  };
}
