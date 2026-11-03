"use client";

import { useEffect, useState } from "react";
import { loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { sourcesPageRows, type SourceRow } from "../domain/boundary-sources";
import { useMapText } from "./useMapText";

/**
 * Every boundary file the maps ship, with who made it, under what licence and from which year, read from the catalogue the maps themselves read
 * (`/geo/manifest.json`), so the page can never describe files other than the ones in use. A share-alike file links to its derived copy.
 */
export function MapSourcesTable() {
  const { levelSingular } = useMapText();
  const [rows, setRows] = useState<SourceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void loadBoundaryManifest().then((m) => { if (m) setRows(sourcesPageRows(m)); else setFailed(true); });
  }, []);
  if (failed) return <p className="text-sm text-slate-400">The list could not be loaded just now. Try again in a moment, or write to us and we will send it.</p>;
  if (!rows) return <p className="text-sm text-slate-400">Loading the list…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm" data-testid="sources-table">
        <caption className="pb-2 text-left text-xs text-slate-400">{rows.length} boundary files</caption>
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
            <th scope="col" className="py-2 pr-4 font-medium">Country</th>
            <th scope="col" className="py-2 pr-4 font-medium">Level</th>
            <th scope="col" className="py-2 pr-4 font-medium">Made by</th>
            <th scope="col" className="py-2 pr-4 font-medium">Licence</th>
            <th scope="col" className="py-2 pr-4 font-medium">Year</th>
            <th scope="col" className="py-2 font-medium">Copy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.file} className="border-b border-white/5 align-top">
              <th scope="row" className="py-1.5 pr-4 font-medium text-slate-200">{r.country}</th>
              <td className="py-1.5 pr-4">{levelSingular(r.level)}</td>
              <td className="py-1.5 pr-4">{r.source}</td>
              <td className="py-1.5 pr-4">{r.licence}</td>
              <td className="py-1.5 pr-4">{r.yearRepresented}</td>
              <td className="py-1.5">{r.shareAlike ? <a className="underline" href={`/geo/${r.file}`} download>Download, same licence</a> : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
