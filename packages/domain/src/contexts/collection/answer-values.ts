/** Helpers every field type shares: what is blank, what is a number, "not applicable", dates, and reading an answer by path. Pure. */

export interface NotApplicable { na: true; reason?: string }

export const isNotApplicable = (v: unknown): v is NotApplicable => typeof v === "object" && v !== null && !Array.isArray(v) && (v as { na?: unknown }).na === true;

export const blank = (v: unknown): boolean => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

export const asNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export const isRealDate = (text: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
};

/** A value as a short key, so one table can score or compare any kind of answer: yes/no as words, numbers as digits. */
export function answerKey(v: unknown): string | null {
  if (blank(v) || isNotApplicable(v)) return null;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" ? "yes" : t === "false" ? "no" : v.trim();
  }
  return null;
}

/**
 * Every answer a path names. `a` is a top-level answer; `grid.row.col` a grid cell; `grid.*.col` that column of every row; `list.*.field` one answer per repeat row (the
 * leaf path carries the row number: `list.0.field`). A path that names nothing yields nothing; it never throws.
 */
export function resolvePath(answers: unknown, path: string): Array<{ path: string; value: unknown }> {
  let nodes: Array<{ path: string; value: unknown }> = [{ path: "", value: answers }];
  for (const part of path.split(".")) {
    const next: typeof nodes = [];
    for (const n of nodes) {
      const v = n.value;
      if (part === "*" && Array.isArray(v)) v.forEach((row, i) => next.push({ path: n.path ? `${n.path}.${i}` : String(i), value: row }));
      else if (part === "*" && typeof v === "object" && v !== null) for (const [k, child] of Object.entries(v as Record<string, unknown>)) next.push({ path: n.path ? `${n.path}.${k}` : k, value: child });
      else if (typeof v === "object" && v !== null && !Array.isArray(v) && part in (v as Record<string, unknown>)) next.push({ path: n.path ? `${n.path}.${part}` : part, value: (v as Record<string, unknown>)[part] });
    }
    nodes = next;
  }
  return nodes;
}
