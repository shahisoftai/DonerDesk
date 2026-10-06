"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveLogframeItemAction } from "@/lib/actions/logframe";
import { buildHierarchy, type HierarchyNode } from "@/lib/shared/hierarchy";
import { Badge } from "@/components/data/Badge";
import { LOGFRAME_LEVEL_LABEL } from "@/lib/labels";
import { eligibleParents, logframeLevelTone, outlineLogframe } from "@/features/logframe/domain/logframe-outline";

export interface LogframeTreeItem {
  id: string;
  parentId?: string | null;
  level: string;
  code?: string;
  title: string;
  delivery?: { recordedCount: number; acceptedCount: number; lastActivityDate: string | null; participantsTotal: number };
}

const END_OF_SIBLINGS = 10_000;

/**
 * Logframe results hierarchy. With `editable`, siblings can be reordered by
 * drag (pointer or keyboard: focus the handle, Space, arrows, Space) and any
 * item can be moved under another parent via "Move to". The server validates
 * every move (level rules, no cycles); on failure the local order reverts.
 */
export function LogframeTreeEditor({
  projectId,
  items,
  indicatorCounts,
  editable,
}: {
  projectId: string;
  items: LogframeTreeItem[];
  indicatorCounts: Record<string, number>;
  editable: boolean;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(items);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setLocal(items), [items]);

  const tree = useMemo(() => buildHierarchy(local), [local]);
  const outline = useMemo(() => outlineLogframe(local), [local]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function commit(itemId: string, parentId: string | null, index: number, optimistic: LogframeTreeItem[]) {
    setError(null);
    setBusy(true);
    setLocal(optimistic);
    const result = await moveLogframeItemAction(itemId, { parentId, index });
    setBusy(false);
    if (!result.ok) {
      setLocal(items);
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const activeRow = outline.find((row) => row.item.id === active.id);
    const overRow = outline.find((row) => row.item.id === over.id);
    if (!activeRow || !overRow || activeRow.parentId !== overRow.parentId) return;
    const from = local.findIndex((item) => item.id === active.id);
    const to = local.findIndex((item) => item.id === over.id);
    void commit(String(active.id), activeRow.parentId, overRow.index, arrayMove(local, from, to));
  }

  function moveTo(item: LogframeTreeItem, parentId: string | null) {
    if ((item.parentId ?? null) === parentId) return;
    const reordered = [...local.filter((other) => other.id !== item.id), { ...item, parentId }];
    void commit(item.id, parentId, END_OF_SIBLINGS, reordered);
  }

  return (
    <div className="mt-3">
      {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <Branch
          nodes={tree}
          depth={0}
          projectId={projectId}
          indicatorCounts={indicatorCounts}
          editable={editable}
          busy={busy}
          renderMoveTo={(item) => (
            <MoveToSelect item={item} options={eligibleParents(local, item)} disabled={busy} onMove={(parentId) => moveTo(item, parentId)} />
          )}
        />
      </DndContext>
    </div>
  );
}

type BranchProps = {
  nodes: HierarchyNode<LogframeTreeItem>[];
  depth: number;
  projectId: string;
  indicatorCounts: Record<string, number>;
  editable: boolean;
  busy: boolean;
  renderMoveTo: (item: LogframeTreeItem) => ReactNode;
};

function Branch(props: BranchProps) {
  const { nodes, depth } = props;
  return (
    <SortableContext items={nodes.map((node) => node.id)} strategy={verticalListSortingStrategy}>
      <ul className={depth === 0 ? "space-y-2" : "mt-2 space-y-2 border-l border-slate-200 pl-4 dark:border-slate-800"} role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Logframe hierarchy" : undefined}>
        {nodes.map((node) => <Node key={node.id} node={node} {...props} />)}
      </ul>
    </SortableContext>
  );
}

function Node({ node, depth, projectId, indicatorCounts, editable, busy, renderMoveTo }: BranchProps & { node: HierarchyNode<LogframeTreeItem> }) {
  const sortable = useSortable({ id: node.id, disabled: !editable || busy });
  const count = indicatorCounts[node.id] ?? 0;
  const { children, ...item } = node;
  return (
    <li
      ref={sortable.setNodeRef}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={false}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={sortable.isDragging ? "relative z-10 opacity-80" : undefined}
    >
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {editable && (
            <button
              type="button"
              className="cursor-grab rounded px-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 active:cursor-grabbing"
              aria-label={`Reorder ${node.title}`}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              ⠿
            </button>
          )}
          <Badge tone={logframeLevelTone(node.level)}>{LOGFRAME_LEVEL_LABEL[node.level] ?? node.level}</Badge>
          {node.code && <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{node.code}</span>}
          <span className="truncate font-medium">{node.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {count > 0 && <span className="text-slate-500 dark:text-slate-400">{count} indicator{count === 1 ? "" : "s"}</span>}
          {node.delivery && (
            <span className={node.delivery.recordedCount === 0 ? "text-warning-700 dark:text-warning-400" : "text-slate-500 dark:text-slate-400"}>
              {node.delivery.recordedCount === 0
                ? "Not delivered yet"
                : `${node.delivery.recordedCount} recorded · ${node.delivery.acceptedCount} accepted${node.delivery.participantsTotal > 0 ? ` · ${node.delivery.participantsTotal} participants` : ""}`}
            </span>
          )}
          {editable && renderMoveTo(item)}
          {node.level !== "ACTIVITY" && (
            <Link className="text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/logframe/new?parentId=${encodeURIComponent(node.id)}`}>
              Add child
            </Link>
          )}
          {node.level === "ACTIVITY" && (
            <Link className="text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/activities/new?node=${encodeURIComponent(node.id)}`}>
              Add activity
            </Link>
          )}
          <Link className="text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/logframe/new-indicator?itemId=${encodeURIComponent(node.id)}`}>
            Add indicator
          </Link>
        </div>
      </div>
      {children.length > 0 && (
        <Branch nodes={children} depth={depth + 1} projectId={projectId} indicatorCounts={indicatorCounts} editable={editable} busy={busy} renderMoveTo={renderMoveTo} />
      )}
    </li>
  );
}

function MoveToSelect({
  item,
  options,
  disabled,
  onMove,
}: {
  item: LogframeTreeItem;
  options: LogframeTreeItem[];
  disabled: boolean;
  onMove: (parentId: string | null) => void;
}) {
  const TOP = "__top__";
  return (
    <label className="flex items-center gap-1 text-slate-500">
      <span className="sr-only">Move {item.title} to</span>
      <select
        className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
        value={item.parentId ?? TOP}
        disabled={disabled}
        onChange={(event) => onMove(event.target.value === TOP ? null : event.target.value)}
      >
        <option value={TOP}>Move to: top level</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            Move to: {LOGFRAME_LEVEL_LABEL[option.level] ?? option.level} {option.code ? `${option.code} ` : ""}{option.title}
          </option>
        ))}
      </select>
    </label>
  );
}
