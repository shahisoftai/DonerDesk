const ind = (id: string, code: string, name: string, extra: Record<string, unknown> = {}) => ({ id, code, name, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false, ...extra });
export async function getDataSheetAction(projectId: string) {
  const indicators = projectId === "p2"
    ? [ind("x1", "H-1", "Pregnant women attending antenatal care")]
    : [
        ind("i1", "WASH-1", "People with basic drinking water access"), ind("i2", "WASH-2", "People using basic sanitation (latrines)"), ind("i3", "WASH-3", "Handwashing stations built"),
        ind("i4", "WASH-4", "People reached by hygiene promotion sessions"), ind("i5", "WASH-5", "% of water points functional", { type: "PERCENTAGE", unit: "%", isRate: true }), ind("i6", "ADM-1", "Staff retained"),
      ];
  return { ok: true as const, value: { projectId, financeEnabled: false, periods: [], indicators, cells: [], finance: [] } };
}
