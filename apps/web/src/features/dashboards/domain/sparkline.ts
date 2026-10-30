/**
 * A sparkline as pure geometry: values in, line segments out. A missing value (null) breaks the line, so a gap is a gap and never a dip to zero.
 * The vertical scale runs from the smallest to the largest recorded value (one value is drawn level).
 */
export interface SparkSegment { points: Array<[number, number]> }

export function sparkSegments(values: ReadonlyArray<number | null>, width: number, height: number, pad = 2): SparkSegment[] {
  const real = values.filter((v): v is number => v !== null);
  if (real.length === 0 || values.length === 0) return [];
  const min = Math.min(...real), max = Math.max(...real);
  const span = max - min;
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1));
  const y = (v: number) => (span === 0 ? height / 2 : height - pad - ((v - min) * (height - 2 * pad)) / span);
  const out: SparkSegment[] = [];
  let current: SparkSegment | null = null;
  values.forEach((v, i) => {
    if (v === null) { current = null; return; }
    if (!current) { current = { points: [] }; out.push(current); }
    current.points.push([Math.round(x(i) * 10) / 10, Math.round(y(v) * 10) / 10]);
  });
  return out;
}

export const segmentPath = (s: SparkSegment): string => s.points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`).join(" ");
