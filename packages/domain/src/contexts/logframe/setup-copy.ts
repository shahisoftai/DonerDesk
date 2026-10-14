import { Indicator } from "./indicator.js";
import { LogframeItem } from "./logframe-item.js";

export interface SetupCopyPlan {
  items: LogframeItem[];
  indicators: Indicator[];
  /** Indicators left behind because they were retired in the source project. */
  skippedArchived: number;
}

/**
 * The logframe and indicator definitions of one project, re-created for another: same tree, codes, targets and
 * semantics, new ids. What belongs to the other project's history or people is left behind - recorded values,
 * evidence, activities, the archived indicators, and who was responsible. Parents are re-pointed to the new ids, so the
 * copy keeps its shape; an item whose parent is missing from the source becomes a root rather than being lost.
 */
export function planLogframeCopy(input: {
  items: ReadonlyArray<LogframeItem>;
  indicators: ReadonlyArray<Indicator>;
  tenantId: string;
  targetProjectId: string;
  newId: () => string;
  now: Date;
}): SetupCopyPlan {
  const idMap = new Map(input.items.map((item) => [item.id, input.newId()]));

  const items = input.items.map((item) =>
    LogframeItem.rehydrate({
      id: idMap.get(item.id)!,
      tenantId: input.tenantId,
      projectId: input.targetProjectId,
      createdAt: input.now,
      props: {
        ...(item.parentId && idMap.has(item.parentId) ? { parentId: idMap.get(item.parentId)! } : {}),
        level: item.level,
        ...(item.code ? { code: item.code } : {}),
        title: item.title,
        ...(item.description ? { description: item.description } : {}),
        sortOrder: item.sortOrder,
      },
    }),
  );

  const live = input.indicators.filter((ind) => !ind.isArchived && idMap.has(ind.logframeItemId));
  const indicators = live.map((ind) =>
    Indicator.rehydrate({
      id: input.newId(),
      tenantId: input.tenantId,
      projectId: input.targetProjectId,
      createdAt: input.now,
      props: {
        logframeItemId: idMap.get(ind.logframeItemId)!,
        code: ind.code,
        name: ind.name,
        type: ind.type,
        baseline: ind.baseline,
        target: ind.target,
        ...(ind.unit ? { unit: ind.unit } : {}),
        ...(ind.meansOfVerification ? { meansOfVerification: ind.meansOfVerification } : {}),
        ...(ind.dataSource ? { dataSource: ind.dataSource } : {}),
        ...(ind.frequency ? { frequency: ind.frequency } : {}),
        disaggregationRequired: ind.disaggregationRequired,
        ...(ind.semanticsJson ? { semanticsJson: ind.semanticsJson } : {}),
      },
    }),
  );

  return { items, indicators, skippedArchived: input.indicators.filter((ind) => ind.isArchived).length };
}
