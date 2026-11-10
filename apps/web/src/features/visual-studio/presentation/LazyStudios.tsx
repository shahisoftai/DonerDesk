"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ChartStudio as ChartStudioType } from "@/features/charts/presentation/ChartStudio";
import type { MapExplorer as MapExplorerType } from "@/features/maps/presentation/MapExplorer";

/**
 * The two heavy tools load when their page opens and never with the Studio's lists and tabs (Phase 48.7): the chart library and the map
 * engine stay out of the first bundle. Until they arrive a plain sentence says what is loading, so the page is never blank.
 */
const loading = (what: string) => function Loading() { return <p role="status" className="p-4 text-sm text-slate-500">Loading the {what}…</p>; };

const ChartStudioLazy = dynamic(() => import("@/features/charts/presentation/ChartStudio").then((m) => m.ChartStudio), { ssr: false, loading: loading("chart studio") });
const MapExplorerLazy = dynamic(() => import("@/features/maps/presentation/MapExplorer").then((m) => m.MapExplorer), { ssr: false, loading: loading("map") });

export const LazyChartStudio = (props: ComponentProps<typeof ChartStudioType>) => <ChartStudioLazy {...props} />;
export const LazyMapExplorer = (props: ComponentProps<typeof MapExplorerType>) => <MapExplorerLazy {...props} />;
