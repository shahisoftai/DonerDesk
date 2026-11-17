"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PUBLIC_TOUR_EN as COPY } from "../domain/public-tour-copy";
import { TOUR_CHAPTERS, TOUR_ROLES, TOUR_SCENES, sceneForHash, type TourRole, type TourScene } from "../domain/public-tour-scenes";
import shotsManifest from "../domain/tour-shots.json";

type Rect = { x: number; y: number; w: number; h: number };
const SHOTS = shotsManifest.shots as Record<string, Rect | null | undefined>;
const SIZE = shotsManifest.size as Record<"desktop" | "phone", { width: number; height: number }>;

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
const hrefOf = (s: TourScene) => `/features#${s.feature}`;

/**
 * The public tour: six chapters (plan, collect, track, see, prove, report), optionally narrowed to one role's path, each scene a real
 * screenshot of a sample project with the element it describes spotlighted. The address carries the scene (`/tour#entry-sheet`,
 * `/tour#collect`) so a page can link to one. All words come from `PUBLIC_TOUR_EN`; every scene is also listed as plain text below
 * the viewer, which is what a search engine and a screen reader read first. Screenshots: `scripts/capture-tour.mjs`.
 */
export function PublicTour() {
  const [role, setRole] = useState<TourRole | "all">("all");
  const [sceneId, setSceneId] = useState(TOUR_SCENES[0]!.id);

  const scenes = useMemo(() => (role === "all" ? TOUR_SCENES : TOUR_SCENES.filter((s) => s.roles.includes(role))), [role]);
  const index = Math.max(0, scenes.findIndex((s) => s.id === sceneId));
  const scene = scenes[index]!;
  const last = index === scenes.length - 1;

  useEffect(() => {
    const fromHash = sceneForHash(window.location.hash);
    if (fromHash) setSceneId(fromHash.id);
  }, []);

  const go = (id: string) => {
    setSceneId(id);
    try { window.history.replaceState(null, "", `#${id}`); } catch { /* the address is a convenience */ }
  };
  const chooseRole = (next: TourRole | "all") => {
    setRole(next);
    const list = next === "all" ? TOUR_SCENES : TOUR_SCENES.filter((s) => s.roles.includes(next));
    if (!list.some((s) => s.id === sceneId)) go(list[0]!.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight" && !last) go(scenes[index + 1]!.id);
      if (e.key === "ArrowLeft" && index > 0) go(scenes[index - 1]!.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <section className="sx-hero" style={{ paddingBottom: 24 }}>
        <div className="sx-wrap">
          <p className="sx-crumbs"><Link href="/platform">Platform</Link> › <b>Product tour</b></p>
          <h1 style={{ marginTop: 18, fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 800, maxWidth: "22ch" }}>{COPY.heading}</h1>
          <p className="sx-lede" style={{ marginTop: 16 }}>{COPY.lede}</p>
          <div role="group" aria-label={COPY.ui.rolePrompt} className="sx-tour-roles">
            <span>{COPY.ui.rolePrompt}</span>
            {(["all", ...TOUR_ROLES] as const).map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => chooseRole(r)} title={r === "all" ? undefined : COPY.roles[r].line}>
                {r === "all" ? COPY.ui.allRoles : COPY.roles[r].name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <nav aria-label={COPY.ui.chapterNav} className="sx-strip">
        <div className="sx-wrap sx-tour-chapters">
          {TOUR_CHAPTERS.map((c, i) => {
            const first = scenes.find((s) => s.chapter === c);
            if (!first) return null;
            return (
              <button key={c} type="button" aria-current={scene.chapter === c} onClick={() => go(first.id)}>
                <span>{i + 1}</span>{COPY.chapters[c].name}
              </button>
            );
          })}
        </div>
      </nav>

      <section>
        <div className="sx-wrap">
          <div className="sx-tour-stage">
            <Viewer scene={scene} />
            <aside className="sx-card sx-tour-card" aria-live="polite">
              <p className="sx-eyebrow">{COPY.chapters[scene.chapter].name} · {fill(COPY.ui.sceneOf, { n: index + 1, total: scenes.length })}</p>
              <h2>{COPY.scenes[scene.id]!.title}</h2>
              <p>{COPY.scenes[scene.id]!.body}</p>
              <p className="sx-notice"><b>{COPY.ui.goodToKnow}.</b> {COPY.scenes[scene.id]!.note}</p>
              <p><Link className="sx-more" href={hrefOf(scene)}>{COPY.ui.seeFeature} →</Link></p>
              <div className="sx-tour-actions">
                <button type="button" className="sx-btn sx-ghost" disabled={index === 0} onClick={() => go(scenes[index - 1]!.id)}>{COPY.ui.back}</button>
                {last
                  ? <Link className="sx-btn sx-primary" href="/signup">{COPY.ui.start}</Link>
                  : <button type="button" className="sx-btn sx-primary" onClick={() => go(scenes[index + 1]!.id)}>{COPY.ui.next}</button>}
              </div>
            </aside>
          </div>
          <p className="sx-fine" style={{ marginTop: 12 }}>{COPY.ui.sampleNote}</p>
        </div>
      </section>

      <section className="sx-band" aria-labelledby="tour-all">
        <div className="sx-wrap">
          <h2 id="tour-all" className="sx-eyebrow">{COPY.heading}</h2>
          {TOUR_CHAPTERS.map((c) => (
            <div key={c} className="sx-tour-list">
              <h3>{COPY.chapters[c].name}</h3>
              <p className="sx-fine">{COPY.chapters[c].promise}</p>
              <ul>
                {TOUR_SCENES.filter((s) => s.chapter === c).map((s) => (
                  <li key={s.id} id={s.id}><b>{COPY.scenes[s.id]!.title}.</b> {COPY.scenes[s.id]!.body} <Link className="sx-link" href={hrefOf(s)}>{COPY.ui.seeFeature} →</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="sx-wrap">
          <div className="sx-final">
            <h2>{COPY.ui.finalTitle}</h2>
            <p>{COPY.ui.finalBody}</p>
            <div className="sx-cta-row" style={{ justifyContent: "center", margin: 0 }}>
              <Link className="sx-btn sx-primary" href="/signup">{COPY.ui.tryIt}</Link>
              <Link className="sx-btn sx-ghost" href="/compare">{COPY.ui.compare}</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Viewer({ scene }: { scene: TourScene }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [scene.id]);
  const rect = SHOTS[scene.id] ?? null;
  const size = SIZE[scene.viewport];
  const phone = scene.viewport === "phone";
  const title = COPY.scenes[scene.id]!.title;
  return (
    <figure className={`sx-tour-frame ${phone ? "is-phone" : "is-desktop"}`}>
      {phone ? <p className="sx-fine">{COPY.ui.phoneNote}</p> : (
        <div className="sx-tour-bar" aria-hidden><i /><i /><i /><span>donordesk.online</span></div>
      )}
      <div className="sx-tour-shot" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
        {missing ? (
          <div className="sx-tour-missing">{title}</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={scene.id} src={`/tour/${scene.id}.jpg`} width={size.width} height={size.height} alt={fill(COPY.ui.screenAlt, { title })} onError={() => setMissing(true)} />
        )}
        {rect && !missing ? (
          <div aria-hidden className="sx-tour-spot" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} />
        ) : null}
      </div>
    </figure>
  );
}
