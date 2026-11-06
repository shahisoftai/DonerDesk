import { validateMapWidget, type MapWidgetQuery } from "../../dashboards/map-widget.js";
import { projectSlot } from "../binding.js";
import { defineBlock } from "../block-definition.js";
import { mapModel, type MapData } from "../models/places.js";

/** An interactive map. Figures are read when it is opened, by the person looking, under their own access, and handed in as data. */
export const mapBlock = defineBlock<MapWidgetQuery, unknown, MapData | undefined>({
  kind: "MAP",
  family: "MAPS",
  labelKey: "canvas.block.MAP",
  needsAlt: true,
  defaults: () => ({ view: "RESULTS" }),
  validate: (q) => { const m = validateMapWidget(q); return m ? [{ message: m }] : []; },
  slots: [projectSlot(["PERIOD", "PLACE"])],
  sizes: { min: { w: 4, h: 4 }, max: { w: 12, h: 10 }, default: { w: 12, h: 6 } },
  lint: [],
  resolve: mapModel,
});
