"use client";

import type { ReportArtifact } from "@/lib/server/schemas";
import { PreviewTable, SectionArtifacts, splitBlocks } from "./document-blocks";

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
