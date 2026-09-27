"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Read view of a section's markdown, styled as the donor will read it.
 * Raw HTML is never rendered (no rehype-raw), so section content cannot inject
 * markup. Section-level headings are demoted so the section title stays the
 * top heading inside the document.
 */
const components: Components = {
  h1: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold text-slate-900 dark:text-slate-100">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold text-slate-900 dark:text-slate-100">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold text-slate-900 dark:text-slate-100">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-4 text-[15px] font-semibold text-slate-900 dark:text-slate-100">{children}</h4>,
  h5: ({ children }) => <h4 className="mb-1.5 mt-4 text-[15px] font-semibold text-slate-900 dark:text-slate-100">{children}</h4>,
  h6: ({ children }) => <h4 className="mb-1.5 mt-4 text-[15px] font-semibold text-slate-900 dark:text-slate-100">{children}</h4>,
  p: ({ children }) => <p className="mb-3">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-6 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-6 list-decimal space-y-1">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-slate-200 pl-4 italic text-slate-600 dark:border-white/15 dark:text-slate-300">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-brand-700 underline dark:text-brand-300">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/10">{children}</code>,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="min-w-full border-collapse font-sans text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-slate-300 bg-slate-50 px-2.5 py-1.5 text-left font-semibold dark:border-white/15 dark:bg-white/5">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-slate-200 px-2.5 py-1.5 align-top dark:border-white/10">{children}</td>,
  img: () => null,
};

export function StaticSectionView({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="text-sm italic text-slate-400 dark:text-slate-500">This section is empty.</p>;
  }
  return (
    <div className="font-serif text-[16.5px] leading-[1.7] text-slate-800 dark:text-slate-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
