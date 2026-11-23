import type { FormField, GridColumn } from "./form-model.js";

/**
 * "Make a form from my tool" (Phase 62.10): reads the text of a Word or Excel assessment tool (tables arrive as `a | b | c` rows) and
 * PROPOSES sections, questions and tables. It reads headings, tick options, blanks and header words only, never guesses a value, and
 * quotes the line each question came from, so the person confirms before anything is saved. A line it cannot read is listed, never
 * dropped. Deterministic and language-neutral in structure (the header words it knows are English).
 */
export interface ProposedField { field: FormField; quote: string }
export interface FormProposal { fields: ProposedField[]; sections: number; unread: string[] }

const HEADING = /^SECTION\s*0?\d+\s*[:.\-–]?\s*(.*)$/i;
const BLANK = /_{3,}|\.{4,}/;
const IGNORED_HEADERS = /^(sr\.?\s*#?|s\.?\s*no\.?|#|indicators?|details?|items?|description)$/i;
const COLUMN_WORDS: ReadonlyArray<{ re: RegExp; type: GridColumn["type"]; options?: ReadonlyArray<string> }> = [
  { re: /remark|specify|details|comment|note|description|what is missing/i, type: "TEXT" },
  { re: /adequate|available|functional|working|present|exists?/i, type: "YES_NO" },
  { re: /condition|status|rating/i, type: "SELECT", options: ["Good", "Average", "Poor"] },
  { re: /number|no\.|count|quantity|qty|total|beds|area|sq/i, type: "NUMBER" },
];

const slug = (text: string): string => {
  const base = text.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 34);
  return /^[a-z]/.test(base) ? base : `q_${base}`.slice(0, 36);
};

const isHeading = (line: string): string | null => {
  const m = HEADING.exec(line);
  if (m) return m[1]!.trim() || line;
  return null;
};

function optionsOf(cells: string[]): string[] {
  return cells.map((c) => c.replace(/\s[✓☐☑□o]$|[✓☐☑□]$/u, "").trim()).filter((c) => c && !BLANK.test(c) && c.length <= 40 && !/^\d+$/.test(c));
}

export function proposeFormFromText(text: string): FormProposal {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const out: ProposedField[] = [];
  const unread: string[] = [];
  const used = new Set<string>();
  const key = (label: string): string => { let k = slug(label) || "q"; let n = 2; const base = k; while (used.has(k)) k = `${base.slice(0, 36)}_${n++}`; used.add(k); return k; };
  let sections = 0;
  let lastHeading = "";
  let header: string[] | null = null;
  let grid: { label: string; rows: string[]; columns: GridColumn[]; quote: string } | null = null;

  const closeGrid = (): void => {
    if (grid && grid.rows.length >= 2) {
      const k = key(grid.label);
      out.push({ quote: grid.quote, field: { key: k, label: grid.label, type: "GRID", rows: grid.rows.map((r) => ({ key: slug(r) || "row", label: r })).filter((r, i, all) => all.findIndex((x) => x.key === r.key) === i), columns: grid.columns } });
    }
    grid = null; header = null;
  };

  for (const line of lines) {
    const title = isHeading(line);
    if (title !== null) {
      closeGrid();
      // The contents list repeats each heading; a heading is real only when something follows it, so equal neighbours are merged.
      if (title === lastHeading) continue;
      lastHeading = title;
      out.push({ quote: line, field: { key: key(`s_${title}`), label: title, type: "SECTION" } });
      sections++;
      continue;
    }
    if (line.includes("|")) {
      const cells = line.split("|").map((c) => c.trim());
      const words = cells.filter(Boolean);
      // A header row names the columns of the rows below it.
      const named = words.slice(1).filter((w) => !IGNORED_HEADERS.test(w));
      if (!header && named.length >= 2 && named.every((w) => COLUMN_WORDS.some((c) => c.re.test(w)))) {
        header = cells;
        grid = { label: lastHeading || "Table", rows: [], quote: line, columns: named.map((w) => {
          const hit = COLUMN_WORDS.find((c) => c.re.test(w))!;
          const col: GridColumn = { key: slug(w) || "col", label: w, type: hit.type, ...(hit.options ? { options: hit.options.map((o) => ({ value: o.toLowerCase(), label: o })) } : {}) };
          return col;
        }) };
        continue;
      }
      if (grid && header && cells[0] && cells.length >= header.length) { grid.rows.push(cells[0]); continue; }
      closeGrid();
      const label = cells[0] ?? "";
      const rest = cells.slice(1).filter(Boolean);
      if (!label) { unread.push(line); continue; }
      const lower = rest.map((r) => r.toLowerCase().replace(/\s[✓☐☑□o]$|[✓☐☑□]$/u, "").trim());
      if (lower.includes("yes") && lower.includes("no")) out.push({ quote: line, field: { key: key(label), label, type: "YES_NO" } });
      else if (rest.some((r) => BLANK.test(r) || /number|pkr|km|%|year/i.test(r))) out.push({ quote: line, field: { key: key(label), label, type: /number|pkr|km|%|year/i.test(rest.join(" ")) ? "NUMBER" : "TEXT" } });
      else if (optionsOf(rest).length >= 2) out.push({ quote: line, field: { key: key(label), label, type: "SELECT", options: optionsOf(rest).map((o) => ({ value: slug(o) || "x", label: o })) } });
      else out.push({ quote: line, field: { key: key(label), label, type: "TEXT" } });
      continue;
    }
    closeGrid();
    if (BLANK.test(line)) { const label = line.replace(BLANK, "").replace(/[:\s]+$/, "").trim(); if (label) out.push({ quote: line, field: { key: key(label), label, type: /number|pkr|year|count/i.test(label) ? "NUMBER" : "TEXT" } }); continue; }
    if (/^instructions?\b/i.test(line) || line.length > 120) { out.push({ quote: line, field: { key: key(`n_${line.slice(0, 20)}`), label: line.slice(0, 600), type: "NOTE" } }); continue; }
    unread.push(line);
  }
  closeGrid();
  // A heading with nothing under it (the contents page) is not a section.
  const fields = out.filter((p, i) => p.field.type !== "SECTION" || (out[i + 1] && out[i + 1]!.field.type !== "SECTION"));
  return { fields, sections: fields.filter((p) => p.field.type === "SECTION").length, unread: unread.slice(0, 200) };
}
