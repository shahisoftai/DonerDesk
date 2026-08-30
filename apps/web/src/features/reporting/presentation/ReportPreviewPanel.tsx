"use client";

/**
 * Read-only preview of the report as the donor will read it: each drafted
 * section rendered as prose. The preview never edits; it is the final review
 * surface before submission and export.
 */
export function ReportPreviewPanel({
  sections,
}: {
  sections: Array<{ sectionTitle: string; content?: string; status: string }>;
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
        return (
          <section key={s.sectionTitle} className="card">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.sectionTitle}</h3>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {content
                .split(/\n+/)
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap">{paragraph}</p>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
