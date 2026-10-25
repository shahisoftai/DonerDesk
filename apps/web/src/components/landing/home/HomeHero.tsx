"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./home.module.css";

const ROTATE_MS = 3000;

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

        <div
          className={styles.scene}
          role="img"
          aria-label="Example project: indicator progress, activity sites on a map, a report statement traced to its evidence file, and 92% donor-report readiness, all from one record."
        >
          <svg className={styles.threads} viewBox="0 0 520 520" aria-hidden="true" focusable="false">
            <path d="M150 190 C150 270 110 300 110 372" />
            <path d="M330 190 C380 250 410 300 410 372" />
            <path d="M200 440 C250 470 290 470 330 440" />
          </svg>

          <div className={`${styles.card} ${styles.cardIndicators}`}>
            <p className={styles.cardHead}>
              <span>Emergency Response: Health</span>
              <em>Q3</em>
            </p>
            <div className={styles.ind}>
              <div>
                <span>Children vaccinated</span>
                <strong>1,240 / 1,500</strong>
              </div>
              <i style={{ ["--w" as string]: "83%", ["--c" as string]: "var(--teal)" }} />
            </div>
            <div className={styles.ind}>
              <div>
                <span>Health workers trained</span>
                <strong>64 / 80</strong>
              </div>
              <i style={{ ["--w" as string]: "80%", ["--c" as string]: "var(--sky)" }} />
            </div>
            <div className={styles.ind}>
              <div>
                <span>Clinics supplied</span>
                <strong>9 / 18</strong>
              </div>
              <i style={{ ["--w" as string]: "50%", ["--c" as string]: "var(--saffron)" }} />
            </div>
            <svg className={styles.spark} viewBox="0 0 240 44" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="home-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#3fc1a6" stopOpacity="0.35" />
                  <stop offset="1" stopColor="#3fc1a6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 38 L30 33 L60 35 L90 24 L120 26 L150 15 L180 17 L210 8 L240 4 L240 44 L0 44 Z" fill="url(#home-spark)" />
              <path d="M0 38 L30 33 L60 35 L90 24 L120 26 L150 15 L180 17 L210 8 L240 4" fill="none" stroke="#3fc1a6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>

          <div className={`${styles.card} ${styles.cardMap}`}>
            <p className={styles.cardHead}>
              <span>Where we work</span>
              <em>6 sites</em>
            </p>
            <div className={styles.mapArt} aria-hidden="true">
              <span style={{ left: "22%", top: "30%", ["--c" as string]: "var(--teal)" }} />
              <span style={{ left: "46%", top: "52%", ["--c" as string]: "var(--teal)" }} />
              <span style={{ left: "70%", top: "26%", ["--c" as string]: "var(--saffron)" }} />
              <span style={{ left: "62%", top: "68%", ["--c" as string]: "var(--teal)" }} />
              <span style={{ left: "30%", top: "72%", ["--c" as string]: "var(--coral)" }} />
              <span style={{ left: "84%", top: "56%", ["--c" as string]: "var(--teal)" }} />
            </div>
            <p className={styles.legend}>
              <b style={{ background: "var(--teal)" }} /> On time
              <b style={{ background: "var(--coral)" }} /> Late
            </p>
          </div>

          <div className={`${styles.card} ${styles.cardReport}`}>
            <p className={styles.cardHead}>
              <span>Donor report</span>
              <em>Draft</em>
            </p>
            <i className={styles.line} style={{ width: "92%" }} />
            <i className={styles.line} style={{ width: "74%" }} />
            <p className={styles.claim}>
              <mark>1,240 children were vaccinated in Q3</mark>
              <small>
                <b aria-hidden="true">↳</b> Clinic_register_Sept.pdf
              </small>
            </p>
            <i className={styles.line} style={{ width: "84%" }} />
          </div>

          <div className={`${styles.card} ${styles.cardReady}`}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="26" className={styles.dialTrack} />
              <circle cx="32" cy="32" r="26" className={styles.dialFill} />
            </svg>
            <div>
              <strong>92%</strong>
              <span>ready for the donor</span>
            </div>
          </div>

          <div className={`${styles.chip} ${styles.chipEvidence}`}>
            <b aria-hidden="true" /> 112 evidence files linked
          </div>
          <div className={`${styles.chip} ${styles.chipActivity}`}>
            <b aria-hidden="true" /> 38 of 41 activities accepted
          </div>
        </div>
      </div>
    </section>
  );
}
