"use client";

import { useState } from "react";
import { ResultsMap } from "./ResultsMap";
import { useMapEngine } from "./useMapEngine";
import { useMapText } from "./useMapText";
import { LowDataResults } from "./LowDataResults";
import { useLowData } from "../../design/presentation/use-low-data";
import type { ExplorerProps } from "./results-loader";

/**
 * Results by place on a map: hover for the figure, click for the place panel, drill to finer levels, switch the indicator, step through
 * periods. One engine (MapLibre, Phase 49.9). A device that cannot draw it, or a person in low-data mode, gets the same figures as a table.
 * `compact` is the dashboard card.
 */
export type { PlaceResultsLoader } from "./results-loader";

export function MapExplorer(props: ExplorerProps) {
  const { engine, markFailed } = useMapEngine();
  const { lowData } = useLowData();
  const [showAnyway, setShowAnyway] = useState(false);
  const { t } = useMapText();
  if (lowData && !showAnyway) return <LowDataResults {...props} onShowMap={() => setShowAnyway(true)} />;
  if (engine === "none") return <LowDataResults {...props} />;
  if (engine === "pending") return <p className="text-sm text-slate-500">{t("maps.loading")}</p>;
  return <ResultsMap {...props} onUnavailable={markFailed} />;
}
