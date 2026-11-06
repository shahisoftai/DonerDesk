"use client";

import { useEffect, useState } from "react";
import { datasetQueryFor } from "@donordesk/domain/contexts/reporting/chart-render.js";
import type { ChartSpecV2 } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import type { DatasetResult } from "@donordesk/domain/contexts/reporting/dataset-query.js";
import { resolveChartDatasetAction } from "@/lib/actions/charts";

/** The figures one indicator's chart needs, read for the signed-in person. `error` is a plain sentence (nothing to draw, or not allowed); both are null while reading. */
export function useIndicatorDataset(projectId: string, indicatorId: string, spec: ChartSpecV2 | null): { dataset: DatasetResult | null; error: string | null } {
  const [dataset, setDataset] = useState<DatasetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!spec) return;
    let live = true;
    setDataset(null); setError(null);
    void resolveChartDatasetAction(projectId, datasetQueryFor(spec, [indicatorId])).then((r) => {
      if (!live) return;
      if (!r.ok) setError(r.error.message);
      else if ("unavailable" in r.value) setError(r.value.unavailable);
      else setDataset(r.value.dataset as unknown as DatasetResult);
    });
    return () => { live = false; };
  }, [spec, projectId, indicatorId]);
  return { dataset, error };
}
