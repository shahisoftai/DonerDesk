"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Read view of a section's markdown, styled as the donor will read it.
 * Raw HTML is never rendered (no rehype-raw), so section content cannot inject
 * markup. Section-level headings are demoted so the section title stays the
 * top heading inside the document.
 */
// Typography comes from the shared `.report-prose` class (globals.css), which
// the rich-text editor uses too. Only structural mapping lives here.
const H3 = ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>;
const H4 = ({ children }: { children?: React.ReactNode }) => <h4>{children}</h4>;
const components: Components = {
  h1: H3,
  h2: H3,
  h3: H3,
  h4: H4,
  h5: H4,
  h6: H4,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
  img: () => null,
};

export function StaticSectionView({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="text-sm italic text-slate-400 dark:text-slate-500">This section is empty.</p>;
  }
  return (
    <div className="report-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
