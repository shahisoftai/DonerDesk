"use client";

import { useState } from "react";
import { svgDataUrl, type PreviewPage } from "../../domain/studio-api";

interface Props {
  pages: PreviewPage[] | undefined;
  loading: boolean;
  error: string | undefined;
  selected: number | undefined;
  onSelect: (index: number) => void;
  /** The text a screen reader gets for the whole picture. */
  altText: string | undefined;
}

const ZOOMS = [0.5, 0.75, 1] as const;

/**
 * The page as it will be published: the server draws it with the same composer that makes the file, and this shows
 * the result as an image (an image cannot run scripts, whatever it contains). A click on a block selects it.
 */
export function StudioPreview({ pages, loading, error, selected, onSelect, altText }: Props) {
  const [zoom, setZoom] = useState<number>(0.75);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span aria-live="polite">{loading ? "Updating the preview…" : pages ? `${pages.length} page${pages.length === 1 ? "" : "s"}` : ""}</span>
        <label className="flex items-center gap-1.5">
          Zoom
          <select aria-label="Zoom" className="rounded border border-slate-300 bg-white px-1 py-0.5 dark:border-white/10 dark:bg-slate-900" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
            {ZOOMS.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}
      <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-auto rounded-xl bg-slate-100 p-3 dark:bg-white/5">
        {!pages && !error && <p className="p-6 text-center text-sm text-slate-500">Drawing the page…</p>}
        {pages?.map((page, pageIndex) => (
          <div key={pageIndex} className={`relative mx-auto shadow-md transition-opacity ${loading ? "opacity-70" : ""}`} style={{ width: `${page.width * zoom}px`, maxWidth: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgDataUrl(page.svg)} alt={pageIndex === 0 && altText ? altText : `Page ${pageIndex + 1}`} className="block h-auto w-full bg-white" draggable={false} />
            {(page.blocks ?? []).map((block) => (
              <button
                key={`${block.index}-${block.x}-${block.y}`}
                type="button"
                aria-label={`Edit block ${block.index + 1}`}
                aria-pressed={selected === block.index}
                onClick={() => onSelect(block.index)}
                className={`absolute rounded outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500 ${selected === block.index ? "ring-2 ring-brand-600" : "hover:ring-2 hover:ring-brand-300"}`}
                style={{ left: `${(block.x / page.width) * 100}%`, top: `${(block.y / page.height) * 100}%`, width: `${(block.width / page.width) * 100}%`, height: `${(block.height / page.height) * 100}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
