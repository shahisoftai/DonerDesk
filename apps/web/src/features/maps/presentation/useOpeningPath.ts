"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { findCountry } from "../domain/boundary-sources";
import { nameRef } from "../domain/boundaries/join";
import { homeCountryOf, type HomeCountryPlace, type HomeCountryResults } from "../domain/drill/home-country";
import { decodePath, encodePath, type DrillPath } from "../domain/drill/drill-path";

const ADDRESS_KEY = "map";

/**
 * Where the map opens and how its address follows it: a bookmarked address wins, else the country the rules choose (the one country place,
 * the country of all results, the project's own country when the boundary catalogue knows it). Names learnt from loaded boundaries replace
 * the placeholders an address gave, and the path is written back to the address bar when the map is addressable.
 */
export function useOpeningPath(input: {
  path: DrillPath; setPath: Dispatch<SetStateAction<DrillPath>>; addressed: boolean;
  places: ReadonlyArray<HomeCountryPlace>; results: HomeCountryResults | null; projectCountry: string | null | undefined;
  opened: ReadonlyArray<{ name: string }>;
}) {
  const { path, setPath, addressed, places, results, projectCountry, opened } = input;
  useEffect(() => {
    const fromAddress = addressed ? decodePath(new URLSearchParams(window.location.search).get(ADDRESS_KEY)) : [];
    if (fromAddress.length > 0) { setPath(fromAddress.map((c) => ({ level: c.level, ref: c.ref, name: c.ref.replace(/^name:/, "").replace(/_/g, " ") }))); return; }
    const open = (home: string | null) => { if (home) setPath([{ level: 0, name: home, ref: nameRef(home) }]); };
    const ruled = homeCountryOf({ places, results });
    if (ruled || !projectCountry) { open(ruled); return; }
    void loadBoundaryManifest().then((m) => open(homeCountryOf({ places, results, projectCountry, knownCountries: m ? [findCountry(m, projectCountry)?.name ?? ""].filter(Boolean) : [] })));
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (opened.length === 0) return;
    const named = path.map((c, i) => (opened[i] && opened[i]!.name !== c.name ? { ...c, name: opened[i]!.name } : c));
    if (named.some((c, i) => c !== path[i])) setPath(named);
  }, [opened, path, setPath]);
  useEffect(() => {
    if (!addressed) return;
    const url = new URL(window.location.href);
    if (path.length === 0) url.searchParams.delete(ADDRESS_KEY); else url.searchParams.set(ADDRESS_KEY, encodePath(path));
    window.history.replaceState(null, "", url);
  }, [path, addressed]);
}
