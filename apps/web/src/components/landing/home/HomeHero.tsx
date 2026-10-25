"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./home.module.css";

const ROTATE_MS = 5000;

// Three statements, each with its own sub-head. They cross-fade in one grid cell,
// so the tallest statement sets the height and nothing jumps.
const STATEMENTS = [
  {
    heading: (
      <>
        Your whole programme, <em>in one</em> place.
      </>
    ),
    lede: "Set up the logframe, record activities as they happen, track every indicator and keep the evidence beside the work. Donor reports are drawn from that same record.",
  },
  {
    heading: (
      <>
        Know where your programme stands <em>before</em> the donor asks.
      </>
    ),
    lede: "See every indicator, activity and gap while there is still time to act. The report then draws on the same numbers you have been watching.",
  },
  {
    heading: (
      <>
        Stop rebuilding the programme <em>every quarter.</em>
      </>
    ),
    lede: "Enter each value once. The next period starts from the record you already kept, and the donor report is drafted from it with every claim traced to its source.",
  },
];

export function HomeHero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!paused) setIndex((current) => (current + 1) % STATEMENTS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section
      className={`${styles.band} ${styles.hero}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={`${styles.wrap} ${styles.heroGrid}`}>
        <div>
          <p className={styles.eyebrow}>Programme management for NGOs</p>
          <div className={styles.slides}>
            {STATEMENTS.map((statement, i) => (
              <div key={i} className={`${styles.slide} ${i === index ? styles.slideOn : ""}`} aria-hidden={i !== index}>
                <h1>{statement.heading}</h1>
                <p className={styles.lede}>{statement.lede}</p>
              </div>
            ))}
          </div>

          <div className={styles.btns} id="start">
            <Link href="/signup" className={`${styles.btn} ${styles.btnPrimary}`}>
              Create a free workspace
            </Link>
            <Link href="/tour" className={`${styles.btn} ${styles.btnGhost}`}>
              Take the product tour
            </Link>
          </div>

          <div className={styles.trust}>
            <span>No credit card</span>
            <span>A demo project included</span>
            <span>Each organisation&apos;s data is isolated</span>
          </div>

          <div className={styles.dots} role="group" aria-label="Hero statements">
            {STATEMENTS.map((_, i) => (
              <button
                key={i}
                type="button"
                className={styles.dot}
                aria-label={`Statement ${i + 1} of ${STATEMENTS.length}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>

        <div className={styles.stack}>
        <div
          className={`${styles.visual} ${styles.cycle} ${index === 0 ? styles.visualOn : ""}`}
          role="img"
          aria-hidden={index !== 0}
          aria-label="One record connects four stages in a loop: set up, deliver, monitor and demonstrate. The next period starts from the record you already kept."
        >
          <svg viewBox="0 0 520 520" aria-hidden="true" focusable="false">
            <defs>
              <marker id="home-arrow-0" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#3fc1a6" /></marker>
              <marker id="home-arrow-1" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#f2b544" /></marker>
              <marker id="home-arrow-2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#74b8e6" /></marker>
              <marker id="home-arrow-3" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#f08a72" /></marker>
            </defs>
            <circle className={styles.guide} cx="260" cy="260" r="112" />
            <g className={styles.arcs}>
            <path d="M214.4 157.7 A112 112 0 0 1 305.6 157.7" stroke="#3fc1a6" markerEnd="url(#home-arrow-0)" />
            <path d="M362.3 214.4 A112 112 0 0 1 362.3 305.6" stroke="#f2b544" markerEnd="url(#home-arrow-1)" />
            <path d="M305.6 362.3 A112 112 0 0 1 214.4 362.3" stroke="#74b8e6" markerEnd="url(#home-arrow-2)" />
            <path d="M157.7 305.6 A112 112 0 0 1 157.7 214.4" stroke="#f08a72" markerEnd="url(#home-arrow-3)" />
            </g>
          </svg>
          <div className={styles.hub}>
            <strong>One record</strong>
            <span>Enter it once. Reuse it every period.</span>
          </div>
          <div className={`${styles.stage} ${styles.nodePlan}`}>
            <span className={styles.badge} aria-hidden="true">1</span>
            <div>
              <b>Set up</b>
              <small>Logframe, indicators, team</small>
            </div>
          </div>
          <div className={`${styles.stage} ${styles.nodeDeliver}`}>
            <span className={styles.badge} aria-hidden="true">2</span>
            <div>
              <b>Deliver</b>
              <small>Activities, evidence, My Work</small>
            </div>
          </div>
          <div className={`${styles.stage} ${styles.nodeMonitor}`}>
            <span className={styles.badge} aria-hidden="true">3</span>
            <div>
              <b>Monitor</b>
              <small>Indicator values, Data Center</small>
            </div>
          </div>
          <div className={`${styles.stage} ${styles.nodeDemo}`}>
            <span className={styles.badge} aria-hidden="true">4</span>
            <div>
              <b>Demonstrate</b>
              <small>Checklist, approval, reports</small>
            </div>
          </div>
        </div>

        <div
          className={`${styles.visual} ${styles.pace} ${index === 2 ? styles.visualOn : ""}`}
          role="img"
          aria-hidden={index !== 2}
          aria-label="Q3 progress against target: children vaccinated and health workers trained are on track, clinics supplied is behind, with 75% of the period gone."
        >
          <p className={styles.cardHead}>
            <span>Q3 · Emergency Response</span>
            <em>75% of period gone</em>
          </p>
              <div className={styles.paceRow}>
                <div className={styles.paceMeta}>
                  <span>Children vaccinated</span>
                  <span className={styles.pill} style={{ ["--c" as string]: "var(--teal)" }}>On track</span>
                </div>
                <div className={styles.paceTrack}>
                  <i className={styles.paceFill} style={{ ["--w" as string]: "83%", ["--c" as string]: "var(--teal)" }} />
                  <b className={styles.paceMark} />
                </div>
                <small>1,240 / 1,500 · 83% of target</small>
              </div>
              <div className={styles.paceRow}>
                <div className={styles.paceMeta}>
                  <span>Health workers trained</span>
                  <span className={styles.pill} style={{ ["--c" as string]: "var(--sky)" }}>On track</span>
                </div>
                <div className={styles.paceTrack}>
                  <i className={styles.paceFill} style={{ ["--w" as string]: "80%", ["--c" as string]: "var(--sky)" }} />
                  <b className={styles.paceMark} />
                </div>
                <small>64 / 80 · 80% of target</small>
              </div>
              <div className={styles.paceRow}>
                <div className={styles.paceMeta}>
                  <span>Clinics supplied</span>
                  <span className={styles.pill} style={{ ["--c" as string]: "var(--coral)" }}>Behind</span>
                </div>
                <div className={styles.paceTrack}>
                  <i className={styles.paceFill} style={{ ["--w" as string]: "50%", ["--c" as string]: "var(--coral)" }} />
                  <b className={styles.paceMark} />
                </div>
                <small>9 / 18 · 50% of target</small>
              </div>
          <p className={styles.paceNote}>The marker is how far through the period we are. A bar past it is ahead of time.</p>
        </div>

        <div
          className={`${styles.visual} ${styles.carry} ${index === 1 ? styles.visualOn : ""}`}
          role="img"
          aria-hidden={index !== 1}
          aria-label="Children vaccinated is entered once in Q1 and carried forward into Q2 and Q3. The Q3 donor report is drafted from the same record, with no figures typed again."
        >
          <div className={styles.periods}>
            <div className={styles.period}>
              <p className={styles.periodHead}>Q1</p>
              <div className={styles.periodCard}>
                <span>Children vaccinated</span>
                <strong>412</strong>
                <em className={styles.entered}>Entered once</em>
              </div>
            </div>
            <div className={styles.period}>
              <p className={styles.periodHead}>Q2</p>
              <div className={styles.periodCard}>
                <span>Children vaccinated</span>
                <strong>830</strong>
                <em className={styles.carried}>Carried forward</em>
              </div>
            </div>
            <div className={styles.period}>
              <p className={styles.periodHead}>Q3</p>
              <div className={styles.periodCard}>
                <span>Children vaccinated</span>
                <strong>1,240</strong>
                <em className={styles.carried}>Carried forward</em>
              </div>
            </div>
            <svg className={styles.carryArrows} viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
              <path className={styles.carryPath} d="M28 10 H35" />
              <path className={styles.carryPath} d="M65 10 H72" />
            </svg>
          </div>
          <div className={styles.reportCard}>
            <p className={styles.cardHead}>
              <span>Q3 donor report</span>
              <em>Drafted</em>
            </p>
            <p className={styles.reportLine}>
              Children vaccinated rose to <mark>1,240</mark> in Q3, from 412 in Q1.
            </p>
            <small className={styles.reportNote}>Figures typed again: 0</small>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
