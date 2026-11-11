import { multiCardProblems, resolveMultiCard, type MultiCardInputs, type MultiCardModel, type MultiCardProps } from "../../dashboards/multi-card.js";
import { projectSlot } from "../binding.js";
import { defineBlock } from "../block-definition.js";

/** Several figures in one card (Phase 50.3). Every rule lives in `resolveMultiCard`; nothing is restated here. */
export const multiCardBlock = defineBlock<MultiCardProps, MultiCardModel, MultiCardInputs>({
  kind: "MULTI_CARD",
  family: "NUMBERS",
  labelKey: "canvas.block.MULTI_CARD",
  requiresSetup: true,
  picture: "NUMBER",
  defaults: () => ({ items: [], layout: "GRID", columns: 3, includeDraft: false }),
  validate: (p) => multiCardProblems(p).map((message) => ({ message })),
  slots: [projectSlot(["PERIOD", "DRAFTS", "PLACE"])],
  sizes: { min: { w: 2, h: 2 }, max: { w: 12, h: 6 }, default: { w: 4, h: 3 } },
  lint: [{ id: "MULTI_CARD_CROWDED", severity: "TIP", check: (p) => (p.items.length > 9 && p.columns < 3 ? "Nine or more figures read better in three or four columns." : null) }],
  resolve: (p, data) => {
    if (!data?.sheet && !data?.counts && !data?.metrics) return { state: "unavailable", reason: "The figures are read when this is opened." };
    const model = resolveMultiCard(p, data);
    if (model.items.every((i) => i.value === null)) return { state: "empty", reason: "Nothing recorded yet for these figures." };
    return { state: "ready", model, notes: model.unverifiedCount > 0 ? [`${model.unverifiedCount} of ${model.items.length} figures are not verified yet.`] : [] };
  },
});
