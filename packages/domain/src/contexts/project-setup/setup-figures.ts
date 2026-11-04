/**
 * Figures as the wizard's grounding reads them (extraction audit A4). One number may be spelled "1,250,000", "1.250.000,00",
 * "1 250 000" or "1.25 million"; each spelling becomes one canonical value. A form that can be read two ways ("1,250", "1.250")
 * keeps both readings, so a value matches when any reading agrees and neither is guessed away. Pure.
 */
const NUMBER = /\d{1,3}(?:[ \u00a0\u202f]\d{3}(?!\d))+(?:[.,]\d+)?|\d+(?:[.,]\d+)*/g;
const SCALE: ReadonlyArray<[RegExp, number]> = [
  [/^\s*(billion|milliard|bn)\b/i, 1e9],
  [/^\s*(million|millions|millón|millones|mio|mn|m)\b/i, 1e6],
  [/^\s*(thousand|mille|mil|k)\b/i, 1e3],
];

const canonical = (n: number): string => String(Number(n.toFixed(6)));

function readings(raw: string): number[] {
  // "1 250 000" is one number, but "100 100" may be two table cells: both readings stay.
  if (/\s/.test(raw)) return [...readings(raw.replace(/\s/g, "")), ...raw.split(/\s/).flatMap(readings)];
  const t = raw;
  const dots = (t.match(/\./g) ?? []).length;
  const commas = (t.match(/,/g) ?? []).length;
  if (dots === 0 && commas === 0) return [Number(t)];
  if (dots > 0 && commas > 0) {
    const decimal = t.lastIndexOf(".") > t.lastIndexOf(",") ? "." : ",";
    const group = decimal === "." ? "," : ".";
    return [Number(t.split(group).join("").replace(decimal, "."))];
  }
  const mark = dots > 0 ? "." : ",";
  const parts = t.split(mark);
  if (parts.length > 2) return [Number(parts.join(""))];
  // One mark followed by exactly three digits may be thousands or decimals: both readings stay.
  if (parts[1]!.length === 3) return [Number(parts.join("")), Number(`${parts[0]}.${parts[1]}`)];
  return [Number(`${parts[0]}.${parts[1]}`)];
}

/** One entry per number in the text; each entry lists the canonical values that number can be. */
export function readFigures(text: string): string[][] {
  const out: string[][] = [];
  for (const m of text.matchAll(NUMBER)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    const scale = SCALE.find(([re]) => re.test(after))?.[1] ?? 1;
    out.push([...new Set(readings(m[0]).map((n) => canonical(n * scale)))]);
  }
  return out;
}

/** True when every number of the value can be read as a number of the quote. */
export function figuresSupported(value: string, quote: string): boolean {
  const stated = new Set(readFigures(quote).flat());
  return readFigures(value).every((options) => options.some((o) => stated.has(o)));
}
