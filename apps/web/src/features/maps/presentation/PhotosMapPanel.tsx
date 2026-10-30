"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SiteMapFigure } from "@/features/workplan/presentation/SiteMapFigure";
import { protectedFileDownloadHref, isByteStoredEvidence } from "@/lib/shared/downloads";
import { photoMapData, photoMapSummary, photoPoints, type PhotoInput, type PlaceWithPin } from "../domain/photo-map";

const THUMBS_SHOWN = 8;

/**
 * Photos on the map (after DevResults' Geotagged Photos Map): one dot per place with photos, and under the map the photos of each place, as thumbnails that open the
 * evidence file. A photo's place is the location written on its evidence record; nothing is guessed. Photos stored in Google Drive are listed by name (a thumbnail
 * would need the Drive sign-in), and every file opens only for people who may open it, because the file route checks the same rule as the evidence list.
 */
export function PhotosMapPanel({ projectId, photos, places, country }: { projectId: string; photos: PhotoInput[]; places: PlaceWithPin[]; country?: string | undefined }) {
  const data = useMemo(() => photoMapData(photos, places, country), [photos, places, country]);
  const points = useMemo(() => photoPoints(data), [data]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section aria-labelledby="photos-map" className="space-y-3">
      <h2 id="photos-map" className="text-lg font-semibold">Photos on the map</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">{photoMapSummary(data)}</p>
      {points.length > 0 && <SiteMapFigure points={points} {...(country ? { country } : {})} />}
      <ul className="space-y-4">
        {data.sites.map((s) => {
          const all = open === s.name;
          const shown = all ? s.photos : s.photos.slice(0, THUMBS_SHOWN);
          return (
            <li key={`${s.lat}|${s.lng}`}>
              <h3 className="text-sm font-medium">{s.name} <span className="font-normal text-slate-500">· {s.photos.length} {s.photos.length === 1 ? "photo" : "photos"}</span></h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {shown.map((p) => {
                  const href = `/projects/${projectId}/evidence/${p.id}`;
                  const canThumb = isByteStoredEvidence(p.storageProvider, p.fileUrl);
                  return (
                    <li key={p.id} className="w-28">
                      <Link href={href} className="block hover:underline" title={p.title || p.fileName}>
                        {canThumb
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={protectedFileDownloadHref(p.fileUrl)} alt={p.title || p.fileName} loading="lazy" className="h-20 w-28 rounded border border-slate-200 object-cover dark:border-white/10" />
                          : <span className="flex h-20 w-28 items-center justify-center rounded border border-slate-200 p-1 text-center text-xs text-slate-500 dark:border-white/10">{p.fileName}</span>}
                        <span className="mt-1 block truncate text-xs">{p.title || p.fileName}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {s.photos.length > THUMBS_SHOWN && <button type="button" className="mt-1 text-xs underline" onClick={() => setOpen(all ? null : s.name)}>{all ? "Show fewer" : `Show all ${s.photos.length}`}</button>}
            </li>
          );
        })}
      </ul>
      {data.unplaced.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Photos whose location matches no place ({data.unplaced.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.unplaced.map((p) => <li key={p.id}><Link className="hover:underline" href={`/projects/${projectId}/evidence/${p.id}`}>{p.title || p.fileName}</Link> — “{p.location}”</li>)}
          </ul>
          <p className="mt-1 text-xs text-slate-500">Add the place in <Link className="underline" href="/settings/places">Places</Link> with a pin, or write the location the way a known place is spelled.</p>
        </details>
      )}
    </section>
  );
}
