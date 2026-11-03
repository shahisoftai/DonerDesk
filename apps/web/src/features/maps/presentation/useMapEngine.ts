"use client";

import { useEffect, useState } from "react";
import { useMapServices } from "./MapServices";

/** `NEXT_PUBLIC_MAP_ENGINE=maplibre` draws the new maps; anything else keeps the ECharts ones. A machine with no WebGL always gets ECharts. */
const ENGINE = process.env.NEXT_PUBLIC_MAP_ENGINE ?? "echarts";

export type MapEngine = "maplibre" | "echarts" | "pending";

/** One decision for every map screen: which engine, and a way to give up on the new one (it could not start). */
export function useMapEngine(): { engine: MapEngine; markFailed: () => void } {
  const services = useMapServices();
  const [webGl, setWebGl] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setWebGl(services.canUseWebGL()); }, [services]);
  const engine: MapEngine = ENGINE !== "maplibre" || failed || webGl === false ? "echarts" : webGl === null ? "pending" : "maplibre";
  return { engine, markFailed: () => setFailed(true) };
}
