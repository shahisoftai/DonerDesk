"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlaceItem } from "@/lib/server/schemas-places";
import { ancestorsOf, buildPlaceTree, visibleNodes, type TreeNode } from "../domain/place-tree";
import { useMapText } from "./useMapText";

/**
 * The places this project touches, as a tree beside the map, with how many activities and recorded figures sit at or below each.
 * Choosing a place takes the map to it; choosing one on the map highlights it here. Arrow keys move, Right opens, Left closes (or goes to the
 * parent), Enter chooses. Counts are the project's own: nothing is drawn for a place that no activity or figure names unless "every place" is on.
 */
export function PlaceTree({ places, activityCounts, figurePlaceIds, selectedId, onSelect }: {
  places: readonly PlaceItem[];
  activityCounts: Readonly<Record<string, number>>;
  figurePlaceIds: readonly string[];
  selectedId: string | null;
  onSelect: (placeId: string) => void;
}) {
  const { t } = useMapText();
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const roots = useMemo(
    () => buildPlaceTree(places, { activities: new Map(Object.entries(activityCounts)), figures: new Set(figurePlaceIds) }, { all }),
    [places, activityCounts, figurePlaceIds, all],
  );
  const nodes = useMemo(() => visibleNodes(roots, open), [roots, open]);

  // The country opens on first sight, and a place chosen on the map opens its ancestors so it can be seen.
  useEffect(() => { if (roots.length === 1) setOpen((cur) => (cur.size === 0 ? new Set([roots[0]!.id]) : cur)); }, [roots]);
  useEffect(() => {
    if (!selectedId) return;
    const need = ancestorsOf(roots, selectedId);
    if (need.length > 0) setOpen((cur) => (need.every((id) => cur.has(id)) ? cur : new Set([...cur, ...need])));
    setFocusId(selectedId);
  }, [selectedId, roots]);

  const parentOf = (node: TreeNode): TreeNode | undefined => nodes.find((n) => n.children.some((c) => c.id === node.id));
  const toggle = (id: string, to: boolean) => setOpen((cur) => { const next = new Set(cur); if (to) next.add(id); else next.delete(id); return next; });
  function move(to: TreeNode | undefined) { if (!to) return; setFocusId(to.id); listRef.current?.querySelector<HTMLElement>(`[data-node="${CSS.escape(to.id)}"]`)?.focus(); }

  function onKey(e: React.KeyboardEvent, node: TreeNode, index: number) {
    const isOpen = open.has(node.id);
    if (e.key === "ArrowDown") { e.preventDefault(); move(nodes[index + 1]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(nodes[index - 1]); }
    else if (e.key === "ArrowRight") { e.preventDefault(); if (node.children.length > 0 && !isOpen) toggle(node.id, true); else move(nodes[index + 1]); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); if (isOpen) toggle(node.id, false); else move(parentOf(node)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(node.id); }
  }

  const current = focusId && nodes.some((n) => n.id === focusId) ? focusId : nodes[0]?.id;
  return (
    <section className="space-y-2" aria-labelledby="place-tree-title" data-testid="place-tree">
      <h3 id="place-tree-title" className="text-sm font-semibold">{t("maps.tree.title")}</h3>
      {nodes.length === 0 ? <p className="text-xs text-slate-500">{t("maps.tree.empty")}</p> : (
        <ul ref={listRef} role="tree" aria-labelledby="place-tree-title" className="max-h-72 space-y-0.5 overflow-y-auto text-sm">
          {nodes.map((node, index) => {
            const isOpen = open.has(node.id);
            const chosen = node.id === selectedId;
            return (
              <li key={node.id} role="none">
                <div
                  role="treeitem" aria-level={node.depth + 1} aria-selected={chosen} {...(node.children.length > 0 ? { "aria-expanded": isOpen } : {})}
                  data-node={node.id} tabIndex={node.id === current ? 0 : -1} onKeyDown={(e) => onKey(e, node, index)} onFocus={() => setFocusId(node.id)}
                  className={`flex cursor-pointer items-baseline gap-1 rounded px-1 py-0.5 outline-offset-1 hover:bg-slate-100 dark:hover:bg-white/10 ${chosen ? "bg-brand-50 font-medium dark:bg-white/15" : ""}`}
                  style={{ paddingInlineStart: `${node.depth * 0.9 + 0.25}rem` }} onClick={() => onSelect(node.id)}
                >
                  {node.children.length > 0
                    ? <button type="button" tabIndex={-1} aria-hidden className="w-4 text-xs text-slate-500" onClick={(e) => { e.stopPropagation(); toggle(node.id, !isOpen); }}>{isOpen ? "▾" : "▸"}</button>
                    : <span className="w-4" aria-hidden />}
                  <span className="truncate">{node.name}</span>
                  <span className="ms-auto shrink-0 text-xs text-slate-500">
                    {node.activities > 0 && <bdi dir="ltr" title={t("maps.tree.activities", { count: node.activities })}>{node.activities}</bdi>}
                    {node.activities > 0 && node.figures > 0 && " · "}
                    {node.figures > 0 && <bdi dir="ltr" title={t("maps.tree.figures", { count: node.figures })}>{node.figures}✓</bdi>}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />{all ? t("maps.tree.showUsed") : t("maps.tree.showAll")}</label>
      <p className="text-xs text-slate-500">{t("maps.tree.legend")}</p>
    </section>
  );
}
