"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SiteMap } from "./SiteMap";
import { protectedFileDownloadHref, isByteStoredEvidence } from "@/lib/shared/downloads";
import { photoMapData, photoPoints, type PhotoInput, type PlaceWithPin } from "../domain/photo-map";
import { useMapText } from "./useMapText";

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
  const { t } = useMapText();
  const placed = data.sites.reduce((n, s) => n + s.photos.length, 0);
  // Number-neutral sentences ("Photos on the map: 12 of 20"), so no language needs plural tables.
  const summary = data.total === 0 ? t("maps.photos.none") : [
    t("maps.photos.placed", { placed: String(placed), total: String(data.total), places: String(data.sites.length) }),
    ...(data.unplaced.length > 0 ? [t("maps.photos.unmatched", { count: String(data.unplaced.length) })] : []),
    ...(data.withoutLocation > 0 ? [t("maps.photos.noLocation", { count: String(data.withoutLocation) })] : []),
  ].join(" ");
  return (
    <section aria-labelledby="photos-map" className="space-y-3">
      <h2 id="photos-map" className="text-lg font-semibold">{t("maps.photos.title")}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">{summary}</p>
      {points.length > 0 && <SiteMap points={points} {...(country ? { country } : {})} />}
      <ul className="space-y-4">
        {data.sites.map((s) => {
          const all = open === s.name;
          const shown = all ? s.photos : s.photos.slice(0, THUMBS_SHOWN);
          return (
            <li key={`${s.lat}|${s.lng}`}>
              <h3 className="text-sm font-medium">{s.name} <span className="font-normal text-slate-500">· {t("maps.photos.count", { count: String(s.photos.length) })}</span></h3>
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
              {s.photos.length > THUMBS_SHOWN && <button type="button" className="mt-1 text-xs underline" onClick={() => setOpen(all ? null : s.name)}>{all ? t("maps.photos.fewer") : t("maps.photos.all", { count: String(s.photos.length) })}</button>}
            </li>
          );
        })}
      </ul>
      {data.unplaced.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t("maps.photos.unplacedTitle", { count: String(data.unplaced.length) })}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.unplaced.map((p) => <li key={p.id}><Link className="hover:underline" href={`/projects/${projectId}/evidence/${p.id}`}>{p.title || p.fileName}</Link> — “{p.location}”</li>)}
          </ul>
          <p className="mt-1 text-xs text-slate-500">{t("maps.photos.fixHint")} <Link className="underline" href="/where-we-work/manage">{t("maps.photos.placesLink")}</Link></p>
        </details>
      )}
    </section>
  );
}
