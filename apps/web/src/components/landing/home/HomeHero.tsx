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

        <div className={styles.cycle} role="img" aria-label="One record connects four stages: set up, deliver, monitor and demonstrate.">
          <svg viewBox="0 0 480 480" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="home-cycle-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3fc1a6" />
                <stop offset="0.4" stopColor="#f2b544" />
                <stop offset="0.7" stopColor="#74b8e6" />
                <stop offset="1" stopColor="#f08a72" />
              </linearGradient>
            </defs>
            <circle className={styles.ring} cx="240" cy="240" r="190" />
            <circle className={styles.flow} cx="240" cy="240" r="190" stroke="url(#home-cycle-gradient)" />
          </svg>
          <div className={`${styles.stageNode} ${styles.nodePlan}`}>
            <b>Set up</b>
            <small>Logframe, indicators, team</small>
          </div>
          <div className={`${styles.stageNode} ${styles.nodeDeliver}`}>
            <b>Deliver</b>
            <small>Activities, evidence, My Work</small>
          </div>
          <div className={`${styles.stageNode} ${styles.nodeMonitor}`}>
            <b>Monitor</b>
            <small>Indicator values, Data Center</small>
          </div>
          <div className={`${styles.stageNode} ${styles.nodeDemo}`}>
            <b>Demonstrate</b>
            <small>Checklist, approval, reports</small>
          </div>
          <div className={styles.core}>
            <p className={styles.eyebrow}>Example project</p>
            <h3>Emergency Response: Health</h3>
            <div className={styles.coreRow}>
              <span>Children vaccinated, Q3</span>
              <strong>1,240 / 1,500</strong>
            </div>
            <div className={styles.coreRow}>
              <span>Activities accepted</span>
              <strong>38 of 41</strong>
            </div>
            <div className={styles.coreRow}>
              <span>Evidence linked</span>
              <strong>112 files</strong>
            </div>
            <div className={styles.bar} aria-hidden="true">
              <i />
            </div>
            <p className={styles.note}>Readiness for the donor report: 92%</p>
          </div>
        </div>
      </div>
    </section>
  );
}
