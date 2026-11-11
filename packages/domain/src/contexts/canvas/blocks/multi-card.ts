import { multiCardProblems, resolveMultiCard, type MultiCardModel, type MultiCardProps } from "../../dashboards/multi-card.js";
import { optionalProjectSlot } from "../binding.js";
import { defineBlock } from "../block-definition.js";
import type { CanvasFacts } from "../facts.js";

/**
 * Several figures in one card (Phase 50.3). It reads the project's facts like the infographic-style blocks: one sheet and one set of
 * counts per project, so a repeater of cards over places reads once. A single place (a repeater item, or a viewer's one-place filter)
 * narrows every figure to what that place recorded. Every rule lives in `resolveMultiCard`; nothing is restated here.
 */
export const multiCardBlock = defineBlock<MultiCardProps, MultiCardModel, CanvasFacts | undefined>({
  kind: "MULTI_CARD",
  family: "NUMBERS",
  labelKey: "canvas.block.MULTI_CARD",
  requiresSetup: true,
  picture: "NUMBER",
  reads: "FACTS",
  defaults: () => ({ items: [], layout: "GRID", columns: 3, includeDraft: false }),
  validate: (p) => multiCardProblems(p).map((message) => ({ message })),
  slots: [optionalProjectSlot(["PERIOD", "DRAFTS", "PLACE"])],
  sizes: { min: { w: 2, h: 2 }, max: { w: 12, h: 6 }, default: { w: 4, h: 3 } },
  lint: [{ id: "MULTI_CARD_CROWDED", severity: "TIP", check: (p) => (p.items.length > 9 && p.columns < 3 ? "Nine or more figures read better in three or four columns." : null) }],
  resolve: (p, facts) => {
    if (!facts) return { state: "unavailable", reason: "The figures are read when this is opened." };
    const one = facts.locationKeys?.length === 1 ? facts.locationKeys[0]! : undefined;
    const model = resolveMultiCard(p, { sheet: facts.sheet, counts: facts.counts, ...(one ? { place: { key: one, name: facts.placeName ?? one } } : {}) });
    if (model.items.length > 0 && model.items.every((i) => i.value === null)) return { state: "empty", reason: "Nothing recorded yet for these figures." };
    return { state: "ready", model, notes: model.unverifiedCount > 0 ? [`${model.unverifiedCount} of ${model.items.length} figures are not verified yet.`] : [] };
  },
});
