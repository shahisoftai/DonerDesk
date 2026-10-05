/**
 * Links a recorded activity to the logframe's own ACTIVITY node, so the logframe shows delivery.
 * Pure: takes the project's logframe items, returns the consistent {logframeActivityId, outputId}
 * pair or a plain reason a person can act on. Giving only the node derives the output from its
 * ancestry (no double entry); giving both requires them to agree.
 */
export interface LogframeNodeFact {
  id: string;
  parentId?: string | undefined;
  level: string;
  title?: string | undefined;
}

export type ActivityNodeLink =
  | { ok: true; value: { logframeActivityId?: string; outputId?: string } }
  | { ok: false; message: string };

function ancestorOutput(nodes: ReadonlyMap<string, LogframeNodeFact>, start: LogframeNodeFact): LogframeNodeFact | undefined {
  const seen = new Set<string>();
  let cur: LogframeNodeFact | undefined = start.parentId ? nodes.get(start.parentId) : undefined;
  while (cur && !seen.has(cur.id)) {
    if (cur.level === "OUTPUT") return cur;
    seen.add(cur.id);
    cur = cur.parentId ? nodes.get(cur.parentId) : undefined;
  }
  return undefined;
}

export function resolveActivityNodeLink(
  items: ReadonlyArray<LogframeNodeFact>,
  input: { logframeActivityId?: string | undefined; outputId?: string | undefined },
): ActivityNodeLink {
  const nodes = new Map(items.map((i) => [i.id, i]));
  const { logframeActivityId, outputId } = input;

  if (outputId) {
    const out = nodes.get(outputId);
    if (!out) return { ok: false, message: "The chosen output is not part of this project's logframe." };
    if (out.level !== "OUTPUT") return { ok: false, message: "An output must be a logframe item at the Output level." };
  }
  if (!logframeActivityId) return { ok: true, value: outputId ? { outputId } : {} };

  const node = nodes.get(logframeActivityId);
  if (!node) return { ok: false, message: "The chosen logframe activity is not part of this project's logframe." };
  if (node.level !== "ACTIVITY") return { ok: false, message: "Choose a logframe item at the Activity level." };
  const parentOutput = ancestorOutput(nodes, node);
  if (outputId && parentOutput && parentOutput.id !== outputId) {
    return { ok: false, message: `That logframe activity belongs to output "${parentOutput.title ?? parentOutput.id}", not the output you chose.` };
  }
  const derived = outputId ?? parentOutput?.id;
  return { ok: true, value: derived ? { logframeActivityId, outputId: derived } : { logframeActivityId } };
}
