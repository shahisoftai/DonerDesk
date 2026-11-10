import type { DatasetPlace } from "./dataset-query.js";
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
