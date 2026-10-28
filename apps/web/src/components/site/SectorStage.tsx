"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import Link from "next/link";
import { BubbleMap, PlaceBars, PlaceDonut, PlaceTable, SectorDashboard } from "./charts";
import { SECTORS } from "./site-data";

type Kind = "bars" | "donut" | "map" | "table";
interface Ctx { index: number; setIndex: (i: number) => void; kind: Kind; setKind: (k: Kind) => void }
const SectorContext = createContext<Ctx | null>(null);
const useSector = (): Ctx => {
  const c = useContext(SectorContext);
  if (!c) throw new Error("SectorStage parts must sit inside SectorProvider");
  return c;
};

/** One chosen sector shared by the hero and the "see it your way" section. */
export function SectorProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [kind, setKind] = useState<Kind>("bars");
  return <SectorContext.Provider value={{ index, setIndex, kind, setKind }}>{children}</SectorContext.Provider>;
}

export function Hero() {
  const { t } = useI18n();
  const { index, setIndex } = useSector();
  const sector = SECTORS[index]!;
  return (
    <section className="sx-hero" id="hero">
      <div className="sx-wrap sx-hero-grid">
        <div>
          <p className="sx-eyebrow">{t("site.hero.eyebrow")}</p>
          <h1 style={{ marginTop: 14 }}>{t("site.hero.title.a")}<em>{t("site.hero.title.em")}</em>{t("site.hero.title.b")}</h1>
          <p className="sx-lede" style={{ marginTop: 20 }}>{t("site.hero.lede")}</p>
          <div className="sx-cta-row">
            <Link className="sx-btn sx-primary" href="/tour">{t("site.hero.cta1")}</Link>
            <Link className="sx-btn sx-ghost" href="/signup">{t("site.hero.cta2")}</Link>
          </div>
          <p className="sx-fine">{t("site.hero.fine")}</p>
          <div className="sx-picker">
            <h2>{t("site.hero.pick")}</h2>
            <div className="sx-chips" role="group" aria-label={t("site.hero.pick")}>
              {SECTORS.map((s, i) => (
                <button key={s.id} type="button" className="sx-chip" aria-pressed={i === index} style={{ ["--dot" as string]: s.dot }} onClick={() => setIndex(i)}><i />{s.label}</button>
              ))}
            </div>
            <p className="sx-sector-line">{sector.line}</p>
            {sector.slug && <Link className="sx-link" href={`/solutions/${sector.slug}`}>{sector.label} programmes →</Link>}
          </div>
        </div>
        <div className="sx-panel" aria-live="polite"><SectorDashboard sector={sector} /></div>
      </div>
    </section>
  );
}

const KINDS: Array<[Kind, string]> = [["bars", "Ranked bars"], ["donut", "Donut"], ["map", "Map of circles"], ["table", "Table"]];

export function StudioDemo() {
  const { index, kind, setKind } = useSector();
  const sector = SECTORS[index]!;
  const note = kind === "donut" ? "A donut shows parts of a whole, so it is offered here because these places add up to the total." : kind === "map" ? "Places are schematic in this example. The product draws on real boundaries." : "Missing values show as gaps, never as zero.";
  return (
    <div className="sx-panel">
      <div className="sx-studio">
        <aside>
          <h4>Show the results by place as</h4>
          <div className="sx-kinds">
            {KINDS.map(([k, label]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>)}
          </div>
          <p className="sx-fine" style={{ marginTop: 6 }}>The real Chart Studio has more than 40 kinds and full editing.</p>
        </aside>
        <div className="sx-stage">
          <b className="sx-stage-title">{sector.placeLabel}, by place</b>
          <div>
            {kind === "bars" && <PlaceBars sector={sector} />}
            {kind === "donut" && <PlaceDonut sector={sector} />}
            {kind === "map" && <div style={{ maxWidth: 380 }}><BubbleMap sector={sector} /></div>}
            {kind === "table" && <PlaceTable sector={sector} />}
          </div>
          <p className="sx-fine">{note}</p>
        </div>
      </div>
    </div>
  );
}
