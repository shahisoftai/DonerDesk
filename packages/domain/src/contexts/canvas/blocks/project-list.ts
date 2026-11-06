import { validateProjectList, type ProjectListQuery } from "../../dashboards/project-list.js";
import { defineBlock } from "../block-definition.js";
import { projectListModel, type ProjectListData } from "../models/places.js";

/** The projects the viewer can see, filtered. Drawn for the viewer; never through a share link. It reads the viewer's whole list, so it has no project of its own. */
export const projectListBlock = defineBlock<ProjectListQuery, unknown, ProjectListData | undefined>({
  kind: "PROJECT_LIST",
  family: "TABLES",
  labelKey: "canvas.block.PROJECT_LIST",
  defaults: () => ({ affiliation: "ALL" } as ProjectListQuery),
  validate: (q) => { const m = validateProjectList(q); return m ? [{ message: m }] : []; },
  slots: [],
  sizes: { min: { w: 4, h: 3 }, max: { w: 12, h: 10 }, default: { w: 12, h: 4 } },
  lint: [],
  resolve: projectListModel,
});
