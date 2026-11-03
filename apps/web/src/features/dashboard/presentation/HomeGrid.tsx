import type { ReactNode } from "react";
import type { PanelSpan } from "../domain/home-layout";

/** Full width on a phone and a tablet; the chosen share of 12 columns from a laptop up. Whole class names so the stylesheet scan finds them. */
const SPAN_CLASS: Readonly<Record<PanelSpan, string>> = {
  4: "col-span-12 lg:col-span-4",
  6: "col-span-12 lg:col-span-6",
  8: "col-span-12 lg:col-span-8",
  12: "col-span-12",
};

export interface GridPlacement<K extends string> { readonly key: K; readonly span: PanelSpan; readonly hidden: boolean }

/**
 * Lays panels out in the order and widths a layout gives. It knows nothing about any panel: a renderer per key makes the content, and a
 * renderer that answers `null` (nothing to show for this person) leaves no gap. Panels do not stretch to the tallest neighbour.
 */
export function HomeGrid<K extends string>({ layout, render }: { layout: ReadonlyArray<GridPlacement<K>>; render: (key: K) => ReactNode | null }) {
  return (
    <div className="grid grid-cols-12 items-start gap-x-6 gap-y-6">
      {layout.map((p) => {
        if (p.hidden) return null;
        const node = render(p.key);
        if (node === null) return null;
        return <div key={p.key} className={`min-w-0 ${SPAN_CLASS[p.span]}`}>{node}</div>;
      })}
    </div>
  );
}
