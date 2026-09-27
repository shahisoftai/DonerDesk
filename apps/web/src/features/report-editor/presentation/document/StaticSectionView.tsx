"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { rehypeClaimHighlights, rehypeMarkVerifiedTables, type Highlight } from "../../application/highlight-hast";

/**
 * Read view of a section's markdown, styled as the donor will read it.
 * Raw HTML is never rendered (no rehype-raw), so section content cannot inject
 * markup. Section-level headings are demoted so the section title stays the
 * top heading inside the document. Checked statements are marked in place
 * (see `highlight-hast.ts`); interaction is delegated from the wrapper.
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
  table: ({ children, node }) => {
    const verified = node?.properties?.dataVerifiedTable as string | undefined;
    return (
      <div className="overflow-x-auto">
        {verified && (
          <p className="mb-1 flex items-center gap-1.5 font-sans text-xs text-slate-600 dark:text-slate-300">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            {verified === "changed" ? (
              <span className="text-warning-700 dark:text-warning-400">Built from verified data · numbers were changed — re-check them</span>
            ) : (
              <span>Built from verified data</span>
            )}
          </p>
        )}
        <table>{children}</table>
      </div>
    );
  },
  img: () => null,
};

export type StaticSectionViewProps = {
  content: string;
  highlights?: Highlight[];
  focusedClaimId?: string;
  verifiedTables?: { verified: ReadonlySet<number>; drifted: ReadonlySet<number> };
  /** Click / Enter on a marked statement. */
  onClaim?: (claimId: string) => void;
  /** Hover / focus on a marked statement (`null` = left it). */
  onPeek?: (claimId: string | null, element: HTMLElement | null) => void;
};

const EMPTY_SET: ReadonlySet<number> = new Set();

function claimElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>("[data-claim-id]") : null;
}

export function StaticSectionView({ content, highlights = [], focusedClaimId, verifiedTables, onClaim, onPeek }: StaticSectionViewProps) {
  const rehypePlugins = useMemo(
    () => [
      [rehypeClaimHighlights, { source: content, highlights, focusedId: focusedClaimId }] as [typeof rehypeClaimHighlights, Parameters<typeof rehypeClaimHighlights>[0]],
      [rehypeMarkVerifiedTables, { verified: verifiedTables?.verified ?? EMPTY_SET, drifted: verifiedTables?.drifted ?? EMPTY_SET }] as [
        typeof rehypeMarkVerifiedTables,
        Parameters<typeof rehypeMarkVerifiedTables>[0],
      ],
    ],
    [content, highlights, focusedClaimId, verifiedTables],
  );

  if (!content.trim()) {
    return <p className="text-sm italic text-slate-400 dark:text-slate-500">This section is empty.</p>;
  }

  const interactive = highlights.length > 0 && (onClaim || onPeek);
  return (
    <div
      className="report-prose"
      onClick={
        interactive
          ? (e) => {
              const el = claimElement(e.target);
              if (el?.dataset.claimId) onClaim?.(el.dataset.claimId);
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              const el = claimElement(e.target);
              if (!el?.dataset.claimId) return;
              e.preventDefault();
              onClaim?.(el.dataset.claimId);
            }
          : undefined
      }
      onMouseOver={interactive ? (e) => onPeek?.(claimElement(e.target)?.dataset.claimId ?? null, claimElement(e.target)) : undefined}
      onFocus={interactive ? (e) => onPeek?.(claimElement(e.target)?.dataset.claimId ?? null, claimElement(e.target)) : undefined}
      onMouseLeave={interactive ? () => onPeek?.(null, null) : undefined}
      onBlur={interactive ? () => onPeek?.(null, null) : undefined}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
