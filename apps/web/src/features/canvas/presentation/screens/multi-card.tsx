import { colourOf, conditionalEffect, formatFigure, type BlockFormat, type ColourChoice, type PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import type { BlockModel } from "@donordesk/domain/contexts/canvas/index.js";
import type { MultiCardModel } from "@donordesk/domain/contexts/dashboards/index.js";
import { readyOrNothing } from "./screen-text";

const CALLOUT_PX = { M: 20, L: 28, XL: 36, XXL: 48 } as const;

interface Props { model: BlockModel<MultiCardModel>; frame: PaintFrame; format?: BlockFormat | undefined }

/**
 * Several figures in one card (Phase 50.3): the main figure large, its label under it (or above, or beside), the others in a grid. A
 * figure nobody recorded reads "Not yet reported" in quiet text, never 0; a conditional colour is never put on one.
 */
export function MultiCardScreen(props: Props) {
  const { format, frame } = props;
  const theme = frame.theme as Parameters<typeof colourOf>[0];
  const resolve = (c: ColourChoice) => colourOf(theme, c);
  const values = (props.model.state === "ready" ? props.model.model.items : []).map((i) => i.value).filter((v): v is number => v !== null);
  const range = values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  const size = CALLOUT_PX[format?.callout?.size ?? "L"];
  const weight = (format?.callout?.weight ?? "bold") === "bold" ? 700 : 400;
  const labelPos = format?.callout?.labelPosition ?? "below";
  return readyOrNothing(props, (m, text) => (
    <div className="flex h-full flex-col gap-2 p-3" data-testid="multi-card">
      {m.header && <p className="text-sm font-semibold" style={{ color: format?.referenceLabels?.color ? resolve(format.referenceLabels.color) : undefined }}>{m.header}</p>}
      <ul className="grid gap-3" style={{ gridTemplateColumns: `repeat(${m.layout === "ROW" ? m.items.length : m.layout === "COLUMN" ? 1 : m.columns}, minmax(0, 1fr))` }}>
        {m.items.map((it, i) => {
          const shown = formatFigure(it.value, format?.numbers ?? {}, frame.language);
          const effect = conditionalEffect(it.value, format?.conditional?.rules ?? [], range, resolve);
          const colour = effect?.color && effect.target !== "background" ? resolve(effect.color) : format?.callout?.color ? resolve(format.callout.color) : undefined;
          const fill = effect?.color && effect.target === "background" ? resolve(effect.color) : undefined;
          const label = <p className="text-xs text-[var(--tile-meta)]" style={{ color: format?.callout?.labelColor ? resolve(format.callout.labelColor) : undefined }}>{it.label}</p>;
          return (
            <li key={i} data-figure={shown === null ? "none" : "value"} className={`rounded ${labelPos === "start" ? "flex items-baseline gap-2" : ""} ${fill ? "p-2" : ""}`} style={fill ? { background: fill } : undefined}>
              {labelPos === "above" && label}
              {shown === null
                ? <p className="text-sm italic text-[var(--tile-meta)]">{text.l.notYetReported}</p>
                : <p className="tabular-nums leading-tight" style={{ fontSize: i === 0 || m.layout !== "GRID" ? size : Math.max(16, size * 0.6), fontWeight: weight, color: colour }}>{shown}{it.unverified ? <span className="ms-1 align-super text-[10px] text-amber-700">*</span> : null}</p>}
              {labelPos !== "above" && label}
            </li>
          );
        })}
      </ul>
      {m.unverifiedCount > 0 && <p className="mt-auto text-[11px] text-amber-800 dark:text-amber-200">* {text.l.notVerifiedYet}</p>}
    </div>
  ));
}
