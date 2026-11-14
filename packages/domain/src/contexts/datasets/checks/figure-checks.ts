import { MAX_FINDINGS_PER_CHECK } from "../limits.js";
import type { CheckDef, CheckInput } from "./types.js";
import { colOf, fig, fmt, keysOf, needColumns, numOf } from "./types.js";

type Out = ReturnType<CheckDef["run"]>;
const cap = (out: Out): Out => out.slice(0, MAX_FINDINGS_PER_CHECK);
/** Rows where every listed figure is recorded; a row with a gap is never judged (a gap is not a 0). */
const complete = (input: CheckInput, keys: readonly string[]) => input.rows.filter((r) => keys.every((k) => fig(r.values[k]) !== null));

export const NOT_NEGATIVE: CheckDef = {
  key: "NOT_NEGATIVE", label: "Not below zero", defaultSeverity: "BLOCK", always: false,
  params: [{ key: "columns", label: "Figures", type: "COLUMNS" }],
  validate: (p, cols) => (keysOf(p.columns).length ? needColumns(cols, keysOf(p.columns)) : "Choose the figures that cannot be below zero."),
  run: (input, p) => {
    const out: Out = [];
    for (const k of keysOf(p.columns)) {
      const c = colOf(input.columns, k)!;
      for (const r of input.rows) { const v = fig(r.values[k]); if (v !== null && v < 0) out.push({ rows: [r.fileRow], column: k, message: `Row ${r.fileRow}: ${c.label} is ${fmt(v)}.` }); }
    }
    return cap(out);
  },
};

export const RANGE: CheckDef = {
  key: "RANGE", label: "Within a range", defaultSeverity: "WARN", always: false,
  params: [{ key: "column", label: "Figure", type: "COLUMN" }, { key: "min", label: "Lowest", type: "NUMBER" }, { key: "max", label: "Highest", type: "NUMBER" }],
  validate: (p, cols) => needColumns(cols, [String(p.column ?? "")]) ?? (numOf(p.min) === undefined && numOf(p.max) === undefined ? "Give a lowest or a highest value." : undefined),
  run: (input, p) => {
    const c = colOf(input.columns, p.column)!;
    const min = numOf(p.min), max = numOf(p.max);
    const unit = c.unit ? ` ${c.unit}` : "";
    return cap(input.rows.flatMap((r) => {
      const v = fig(r.values[c.key]);
      if (v === null) return [];
      if (max !== undefined && v > max) return [{ rows: [r.fileRow], column: c.key, message: `Row ${r.fileRow}: ${c.label} ${fmt(v)}${unit} is above ${fmt(max)}${unit}.` }];
      if (min !== undefined && v < min) return [{ rows: [r.fileRow], column: c.key, message: `Row ${r.fileRow}: ${c.label} ${fmt(v)}${unit} is below ${fmt(min)}${unit}.` }];
      return [];
    }));
  },
};

/** A total equals the sum of its parts ("exits 812, but the outcomes add to 790"). */
export const SUM_EQUALS: CheckDef = {
  key: "SUM_EQUALS", label: "Parts add up to the total", defaultSeverity: "WARN", always: false,
  params: [{ key: "total", label: "Total", type: "COLUMN" }, { key: "parts", label: "Parts", type: "COLUMNS" }],
  validate: (p, cols) => (keysOf(p.parts).length < 2 ? "Choose at least two parts." : needColumns(cols, [String(p.total ?? ""), ...keysOf(p.parts)])),
  run: (input, p) => {
    const total = colOf(input.columns, p.total)!, parts = keysOf(p.parts);
    return cap(complete(input, [total.key, ...parts]).flatMap((r) => {
      const sum = parts.reduce((a, k) => a + (fig(r.values[k]) ?? 0), 0);
      const t = fig(r.values[total.key])!;
      return Math.abs(sum - t) > 1e-6 ? [{ rows: [r.fileRow], column: total.key, message: `Row ${r.fileRow}: ${total.label} ${fmt(t)}, but ${parts.map((k) => colOf(input.columns, k)?.label ?? k).join(" + ")} = ${fmt(sum)}.` }] : [];
    }));
  },
};

/** Opening + in − out = closing (stock, cases, people in a programme): "opening 100 + received 50 − used 30 ≠ closing 140". */
export const BALANCE: CheckDef = {
  key: "BALANCE", label: "Opening + in − out = closing", defaultSeverity: "WARN", always: false,
  params: [{ key: "opening", label: "Opening", type: "COLUMN" }, { key: "in", label: "In", type: "COLUMNS" }, { key: "out", label: "Out", type: "COLUMNS" }, { key: "closing", label: "Closing", type: "COLUMN" }],
  validate: (p, cols) => (keysOf(p.in).length + keysOf(p.out).length === 0 ? "Choose what comes in or goes out." : needColumns(cols, [String(p.opening ?? ""), String(p.closing ?? ""), ...keysOf(p.in), ...keysOf(p.out)])),
  run: (input, p) => {
    const ins = keysOf(p.in), outs = keysOf(p.out), open = String(p.opening), close = String(p.closing);
    const name = (k: string): string => (colOf(input.columns, k)?.label ?? k).toLowerCase();
    return cap(complete(input, [open, close, ...ins, ...outs]).flatMap((r) => {
      const v = (k: string): number => fig(r.values[k])!;
      const expected = v(open) + ins.reduce((a, k) => a + v(k), 0) - outs.reduce((a, k) => a + v(k), 0);
      if (Math.abs(expected - v(close)) <= 1e-6) return [];
      const words = [`${name(open)} ${fmt(v(open))}`, ...ins.map((k) => `+ ${name(k)} ${fmt(v(k))}`), ...outs.map((k) => `− ${name(k)} ${fmt(v(k))}`)].join(" ");
      return [{ rows: [r.fileRow], column: close, message: `Row ${r.fileRow}: ${words} = ${fmt(expected)}, not ${name(close)} ${fmt(v(close))}.` }];
    }));
  },
};

/** One figure cannot exceed another ("admitted (420) is more than identified (390)"). */
export const NOT_MORE_THAN: CheckDef = {
  key: "NOT_MORE_THAN", label: "Not more than another figure", defaultSeverity: "WARN", always: false,
  params: [{ key: "column", label: "Figure", type: "COLUMN" }, { key: "limit", label: "Cannot be more than", type: "COLUMN" }],
  validate: (p, cols) => needColumns(cols, [String(p.column ?? ""), String(p.limit ?? "")]) ?? (p.column === p.limit ? "Choose two different figures." : undefined),
  run: (input, p) => {
    const a = colOf(input.columns, p.column)!, b = colOf(input.columns, p.limit)!;
    return cap(complete(input, [a.key, b.key]).flatMap((r) => {
      const x = fig(r.values[a.key])!, y = fig(r.values[b.key])!;
      return x > y ? [{ rows: [r.fileRow], column: a.key, message: `Row ${r.fileRow}: ${a.label.toLowerCase()} (${fmt(x)}) is more than ${b.label.toLowerCase()} (${fmt(y)}).` }] : [];
    }));
  },
};
