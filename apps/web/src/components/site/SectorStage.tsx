"use client";

import { createContext, useContext, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import type { MessageKey } from "@/features/i18n/messages";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import Link from "next/link";
import { BubbleMap, PlaceBars, PlaceDonut, PlaceTable, SectorDashboard } from "./charts";
import { SECTORS } from "./site-data";
import { RecordPanel, ReportPanel } from "./HeroPanels";

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

const SLIDE_MS = 6000;
const SLIDES = [1, 2, 3] as const;

export function Hero() {
  const { t } = useI18n();
  const { index, setIndex } = useSector();
  const sector = SECTORS[index]!;
  const [slide, setSlide] = useState(0);
  const [held, setHeld] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [still, setStill] = useState(true);

  // Auto-advance only when the visitor has not asked for less motion, has not picked a slide, and is not pointing at or typing in the hero.
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (still || held || chosen) return;
    const id = window.setTimeout(() => {
      if (!document.hidden) setSlide((s) => (s + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [slide, still, held, chosen]);

  const pick = (i: number) => { setSlide(i); setChosen(true); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (slide + step + SLIDES.length) % SLIDES.length;
    pick(next);
    (e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next])?.focus();
  };
  const running = !still && !held && !chosen;

  const copy = (n: 1 | 2 | 3) => {
    const k = (s: string) => t(`site.hero.${s}` as MessageKey);
    if (n === 1) return { eyebrow: t("site.hero.eyebrow"), a: k("s1.title.a"), em: k("s1.title.em"), lede: k("s1.lede"), c1: { href: "/tour", label: t("site.hero.cta1") }, c2: { href: "/signup", label: t("site.hero.cta2") } };
    if (n === 2) return { eyebrow: k("s2.eyebrow"), a: k("s2.title.a"), em: k("s2.title.em"), lede: k("s2.lede"), c1: { href: "/platform", label: k("s2.cta1") }, c2: { href: "/signup", label: t("site.hero.cta2") } };
    return { eyebrow: k("s3.eyebrow"), a: k("s3.title.a"), em: k("s3.title.em"), lede: k("s3.lede"), c1: { href: "/tour", label: k("s3.cta1") }, c2: { href: "/compare", label: k("s3.cta2") } };
  };

  return (
    <section className="sx-hero sx-hero-h" id="hero" aria-roledescription="carousel" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <div className="sx-wrap sx-hero-grid">
        <div className="sx-hero-copy">
          <div className="sx-slides">
            {SLIDES.map((n, i) => {
              const c = copy(n);
              const on = slide === i;
              return (
                <div key={n} id={`hero-slide-${n}`} role="tabpanel" aria-labelledby={`hero-tab-${n}`} className={`sx-slide${on ? " sx-on" : ""}`} aria-hidden={!on}>
                  <p className="sx-eyebrow">{c.eyebrow}</p>
                  {on ? <h1 style={{ marginTop: 14 }}>{c.a}<em>{c.em}</em></h1> : <p className="sx-h1" style={{ marginTop: 14 }}>{c.a}<em>{c.em}</em></p>}
                  <p className="sx-lede" style={{ marginTop: 20 }}>{c.lede}</p>
                  <div className="sx-cta-row">
                    <Link className="sx-btn sx-primary" href={c.c1.href}>{c.c1.label}</Link>
                    <Link className="sx-btn sx-ghost" href={c.c2.href}>{c.c2.label}</Link>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sx-tabs" role="tablist" aria-label={t("site.hero.tabs.label")} onKeyDown={onKey}>
            {SLIDES.map((n, i) => (
              <button key={n} id={`hero-tab-${n}`} type="button" role="tab" aria-selected={slide === i} aria-controls={`hero-slide-${n}`} tabIndex={slide === i ? 0 : -1} onClick={() => pick(i)}>
                <span className="sx-tab-n">{n}</span>{t(`site.hero.tab.${n}` as MessageKey)}
                <i className="sx-tab-bar" aria-hidden="true">{slide === i && <b key={`${slide}-${running}`} className={running ? "sx-run" : ""} style={{ animationDuration: `${SLIDE_MS}ms` }} />}</i>
              </button>
            ))}
          </div>
          <p className="sx-fine">{t("site.hero.fine")}</p>
        </div>
        <div className="sx-hero-side">
        <div className="sx-panel sx-hero-panel" aria-live="off">
          <div className={`sx-pslide${slide === 0 ? " sx-on" : ""}`} aria-hidden={slide !== 0}><SectorDashboard sector={sector} /></div>
          <div className={`sx-pslide${slide === 1 ? " sx-on" : ""}`} aria-hidden={slide !== 1}><RecordPanel /></div>
          <div className={`sx-pslide${slide === 2 ? " sx-on" : ""}`} aria-hidden={slide !== 2}><ReportPanel /></div>
        </div>
        <div className={`sx-picker${slide === 0 ? "" : " sx-away"}`} aria-hidden={slide !== 0}>
          <h2>{t("site.hero.pick")}</h2>
          <div className="sx-chips" role="group" aria-label={t("site.hero.pick")}>
            {SECTORS.map((s, i) => (
              <button key={s.id} type="button" className="sx-chip" aria-pressed={i === index} style={{ ["--dot" as string]: s.dot }} onClick={() => { setIndex(i); setChosen(true); }}><i />{s.label}</button>
            ))}
          </div>
          <p className="sx-sector-line">{sector.line}</p>
          {sector.slug && <Link className="sx-link" href={`/solutions/${sector.slug}`}>{sector.label} programmes →</Link>}
        </div>
        </div>
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
          <p className="sx-fine" style={{ marginTop: 6 }}>The real Chart Studio has 39 chart types and full editing.</p>
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
