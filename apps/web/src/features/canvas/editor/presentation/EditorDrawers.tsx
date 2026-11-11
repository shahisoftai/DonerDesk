"use client";

import { useMemo, type ReactNode } from "react";
import { canvasThemeOf, colourOf, projectOf, type BlockFormat, type BlockInstance, type BlockModel, type Canvas, type ColourChoice, type FormatCapability, type InteractionEffect } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { tablesOfDrawings } from "../../domain/data-tables";
import type { EditTab } from "../domain/drawer-state";
import type { DrawerPrefs } from "../domain/drawer-state";
import { AddDrawer } from "./AddDrawer";
import { DataTab } from "./DataTab";
import { DrawerShell } from "./DrawerShell";
import { EditDrawer } from "./EditDrawer";
import { FormatTab } from "./FormatTab";
import { InteractionsTab } from "./InteractionsTab";

/** What the drawers need from the editor; the workspace passes its editor through this narrow port (Phase 50.1). */
export interface DrawerEditorPort {
  canvas: Canvas;
  page: Canvas["pages"][number];
  selectionIds: readonly string[];
  add(kind: string): void;
  addStarter(id: string): void;
  setFormat(ids: readonly string[], capability: FormatCapability, settings: BlockFormat[FormatCapability] | undefined): void;
  setInteraction(sourceId: string, targetId: string, effect: InteractionEffect): void;
}

interface Props {
  editor: DrawerEditorPort;
  prefs: DrawerPrefs;
  onPrefs: (change: Partial<DrawerPrefs>) => void;
  models: Readonly<Record<string, BlockModel<unknown>>> | undefined;
  drawings: ReadonlyArray<{ widgetId: string } & Parameters<typeof tablesOfDrawings>[0][number]>;
  projects: ReadonlyArray<{ id: string; name: string }>;
  indicatorsByProject: Readonly<Record<string, ReadonlyArray<{ id: string; code: string; name: string }>>>;
  fallbackProjectId: string | undefined;
  recent: readonly string[];
  label: (b: BlockInstance) => string;
  build: ReactNode;
  pageSettings: ReactNode;
  multiActions?: ReactNode;
}

/** The two drawers of the editor (Phase 50.1): Add on the outside, Edit beside the canvas. Each opens, pins, floats and resizes on its own. */
export function EditorDrawers({ editor, prefs, onPrefs, models, drawings, projects, indicatorsByProject, fallbackProjectId, recent, label, build, pageSettings, multiActions }: Props) {
  const { t } = useI18n();
  const blocks = useMemo(() => editor.page.blocks.filter((b) => editor.selectionIds.includes(b.id)), [editor.page.blocks, editor.selectionIds]);
  const theme = useMemo(() => canvasThemeOf(editor.canvas), [editor.canvas]);
  const resolve = (c: ColourChoice) => colourOf(theme, c);
  const one = blocks.length === 1 ? blocks[0]! : null;
  const pid = one ? projectOf(one.bindings) ?? fallbackProjectId : undefined;
  const table = useMemo(() => {
    if (!one) return undefined;
    const d = drawings.find((x) => x.widgetId === one.id);
    const tbl = d ? tablesOfDrawings([d])[0] : undefined;
    return tbl ? { headers: tbl.columns, rows: tbl.rows.map((r) => r.map((c) => (c === null ? "" : String(c)))) } : undefined;
  }, [one, drawings]);
  const editOffset = 0;
  const addOffset = prefs.editOpen ? prefs.editWidth : 0;

  return (
    <>
      {prefs.editOpen && (
        <DrawerShell id="edit-drawer-shell" title={t("drawer.edit")} width={prefs.editWidth} pinned={prefs.pinned} offset={editOffset} onWidth={(w) => onPrefs({ editWidth: w })} onPin={(p) => onPrefs({ pinned: p })} onClose={() => onPrefs({ editOpen: false })}>
          <EditDrawer tab={prefs.tab} onTab={(tab: EditTab) => onPrefs({ tab })} selectedCount={blocks.length} pageSettings={pageSettings} build={build} multiActions={multiActions}
            data={one ? <DataTab block={one} model={models?.[one.id]} table={table} projectName={projects.find((p) => p.id === pid)?.name} /> : null}
            format={<FormatTab blocks={blocks} expandAll={prefs.expandAll} onExpandAll={(v) => onPrefs({ expandAll: v })} onSet={(cap, s) => editor.setFormat(blocks.map((b) => b.id), cap, s)}
              card={theme.card} resolve={resolve} columns={table?.headers ?? []} indicators={(pid && indicatorsByProject[pid]) || []} />}
            interactions={one ? <InteractionsTab canvas={editor.canvas} source={one} others={editor.page.blocks.filter((b) => b.id !== one.id)} label={label} onSet={(tgt, e) => editor.setInteraction(one.id, tgt, e)} /> : null} />
        </DrawerShell>
      )}
      {prefs.addOpen && (
        <DrawerShell id="add-drawer-shell" title={t("drawer.add")} width={prefs.addWidth} pinned={prefs.pinned} offset={addOffset} onWidth={(w) => onPrefs({ addWidth: w })} onPin={(p) => onPrefs({ pinned: p })} onClose={() => onPrefs({ addOpen: false })}>
          <AddDrawer recent={recent} onAdd={editor.add} onStarter={editor.addStarter} />
        </DrawerShell>
      )}
    </>
  );
}
