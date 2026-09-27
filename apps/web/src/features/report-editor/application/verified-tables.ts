/**
 * Tables in a section that were built from verified data (Report Editor
 * U24): a markdown table whose header matches a TABLE artifact's columns.
 * Such tables show a "Built from verified data" badge, and a changed number
 * in them raises a re-check warning. Pure; artifacts are parsed defensively.
 */

export type ArtifactLike = { id?: string; kind: string; payload: Record<string, unknown> };

export type MarkdownTable = { header: string[]; rows: string[][] };

export type VerifiedTableMatch = { tableIndex: number; changedNumbers: number };

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());

const SEPARATOR_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** GFM pipe tables in document order. */
export function parseMarkdownTables(markdown: string): MarkdownTable[] {
  const lines = markdown.split("\n");
  const tables: MarkdownTable[] = [];
  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (!lines[i]!.trim().startsWith("|") || !SEPARATOR_RE.test(lines[i + 1]!)) continue;
    const header = splitRow(lines[i]!);
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && lines[j]!.trim().startsWith("|")) {
      rows.push(splitRow(lines[j]!));
      j += 1;
    }
    tables.push({ header, rows });
    i = j - 1;
  }
  return tables;
}

type TablePayload = { labels: string[]; rows: Array<Array<string | number | null>> };

function tablePayload(artifact: ArtifactLike): TablePayload | null {
  if (artifact.kind !== "TABLE") return null;
  const columns = artifact.payload.columns;
  const rows = artifact.payload.rows;
  if (!Array.isArray(columns) || !Array.isArray(rows)) return null;
  const labels = columns.map((c) => (c && typeof c === "object" && "label" in c ? String((c as { label: unknown }).label) : ""));
  const cells = rows.map((r) =>
    r && typeof r === "object" && Array.isArray((r as { cells?: unknown }).cells) ? ((r as { cells: Array<string | number | null> }).cells) : [],
  );
  return { labels, rows: cells };
}

const norm = (s: string) => s.replace(/\*|`/g, "").trim().toLowerCase();
const numberOf = (s: string | number | null | undefined) => {
  if (s === null || s === undefined) return null;
  const cleaned = String(s).replace(/[*`,%\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
};

/** Which tables mirror a verified TABLE artifact, and how many of their numbers changed. */
export function matchVerifiedTables(markdown: string, artifacts: ReadonlyArray<ArtifactLike>): VerifiedTableMatch[] {
  const payloads = artifacts.map(tablePayload).filter((p): p is TablePayload => p !== null && p.labels.length > 0);
  if (payloads.length === 0) return [];
  const matches: VerifiedTableMatch[] = [];
  parseMarkdownTables(markdown).forEach((table, tableIndex) => {
    const payload = payloads.find(
      (p) => p.labels.length === table.header.length && p.labels.every((label, i) => norm(label) === norm(table.header[i] ?? "")),
    );
    if (!payload) return;
    let changedNumbers = 0;
    payload.rows.forEach((row, r) =>
      row.forEach((cell, c) => {
        const expected = numberOf(cell);
        if (expected === null) return;
        if (numberOf(table.rows[r]?.[c]) !== expected) changedNumbers += 1;
      }),
    );
    matches.push({ tableIndex, changedNumbers });
  });
  return matches;
}
