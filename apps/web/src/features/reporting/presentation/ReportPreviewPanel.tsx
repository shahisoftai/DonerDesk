"use client";

import type { ReportArtifact } from "@/lib/server/schemas";

/**
 * Read-only preview of the report as the donor will read it: each drafted
 * section rendered as prose, markdown tables rendered as tables, and the AI
 * Reporter's typed artifacts (verified indicator chart data, period deltas,
 * mandatory-question answers) shown beneath the section. The preview never
 * edits; it is the final review surface before submission and export.
 */
export function ReportPreviewPanel({
  sections,
  artifacts = {},
}: {
  sections: Array<{ id?: string; sectionTitle: string; content?: string; status: string }>;
  artifacts?: Record<string, ReportArtifact[]>;
}) {
  const withContent = sections.filter((s) => s.content && s.content.trim().length > 0);
  if (withContent.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No report content to preview yet. Generate the AI draft first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {withContent.map((s) => {
        const content = s.content ?? "";
        const sectionArtifacts = s.id ? artifacts[s.id] ?? [] : [];
        return (
          <section key={s.id ?? s.sectionTitle} className="card">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.sectionTitle}</h3>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {splitBlocks(content).map((block, index) =>
                block.type === "table" ? (
                  <PreviewTable key={index} header={block.header} rows={block.rows} />
                ) : (
                  <p key={index} className="whitespace-pre-wrap">{block.text}</p>
                ),
              )}
            </div>
            <SectionArtifacts artifacts={sectionArtifacts} contentHasTable={/^\s*\|.*\|\s*$/m.test(content)} />
          </section>
        );
      })}
    </div>
  );
}

type Block = { type: "text"; text: string } | { type: "table"; header: string[]; rows: string[][] };

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** Paragraphs + markdown tables (header, `---` separator, rows). */
function splitBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      i -= 1;
      blocks.push({ type: "table", header, rows });
    } else if (line.trim()) {
      blocks.push({ type: "text", text: line });
    }
  }
  return blocks;
}

function PreviewTable({ header, rows, caption }: { header: string[]; rows: Array<Array<string | number | null>>; caption?: string | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        {caption ? <caption className="mb-1 text-left text-xs font-medium text-slate-600 dark:text-slate-400">{caption}</caption> : null}
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className="border-b border-slate-300 px-2 py-1 text-left font-semibold dark:border-slate-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="odd:bg-slate-50 dark:odd:bg-slate-800/40">
              {row.map((c, i) => (
                <td key={i} className="border-b border-slate-200 px-2 py-1 dark:border-slate-700">{c ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asText = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/**
 * Typed artifacts. A TABLE is skipped when the section content already carries
 * the same table as markdown (the verified indicator table is written into the
 * content so it also reaches the editor and export).
 */
function SectionArtifacts({ artifacts, contentHasTable }: { artifacts: ReportArtifact[]; contentHasTable: boolean }) {
  const visible = [...artifacts]
    .sort((a, b) => a.ordinal - b.ordinal)
    .filter((a) => !(a.kind === "TABLE" && contentHasTable));
  if (visible.length === 0) return null;
  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
      {visible.map((art, i) => (
        <ArtifactView key={art.id ?? i} artifact={art} />
      ))}
    </div>
  );
}

function ArtifactView({ artifact }: { artifact: ReportArtifact }) {
  const p = artifact.payload;
  switch (artifact.kind) {
    case "TABLE": {
      const columns = asArray(p.columns).map((c) => asText((c as { label?: unknown }).label));
      const rows = asArray(p.rows).map((r) => asArray((r as { cells?: unknown }).cells).map((c) => (c === null ? null : asText(c))));
      return <PreviewTable header={columns} rows={rows} caption={artifact.caption} />;
    }
    case "CHART": {
      // Chart data as a compact table; the interactive chart lives in the
      // section chart panel. Every value comes from verified findings.
      const categories = asArray(p.categories).map(asText);
      const series = asArray(p.series).map((s) => ({ name: asText((s as { name?: unknown }).name), data: asArray((s as { data?: unknown }).data) }));
      return (
        <PreviewTable
          caption={artifact.caption ?? asText(p.title)}
          header={["", ...categories]}
          rows={series.map((s) => [s.name, ...s.data.map((d) => (d === null ? null : asText(d)))])}
        />
      );
    }
    case "DELTA": {
      const arrow = p.direction === "UP" ? "▲" : p.direction === "DOWN" ? "▼" : "▬";
      return (
        <p className="text-xs text-slate-700 dark:text-slate-300">
          <span className="font-medium">{artifact.caption ?? "Change from previous period"}:</span> {asText(p.metric)} {asText(p.fromValue)} → {asText(p.toValue)} {arrow}
        </p>
      );
    }
    case "QA":
      return <QaItem question={asText(p.question)} answer={asText(p.answer)} />;
    case "LIST": {
      const items = asArray(p.items).map((it) => asText((it as { text?: unknown }).text));
      const ListTag = p.ordered === true ? "ol" : "ul";
      return (
        <ListTag className={`${p.ordered === true ? "list-decimal" : "list-disc"} ml-5 text-xs`}>
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ListTag>
      );
    }
    case "KEY_VALUE":
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {asArray(p.entries).map((e, i) => (
            <div key={i} className="contents">
              <dt className="font-medium">{asText((e as { key?: unknown }).key)}</dt>
              <dd>{asText((e as { value?: unknown }).value)}</dd>
            </div>
          ))}
        </dl>
      );
    default:
      return null;
  }
}

function QaItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="text-xs">
      <p className="font-medium text-slate-800 dark:text-slate-100">{question}</p>
      <p className="text-slate-700 dark:text-slate-300">{answer}</p>
    </div>
  );
}
