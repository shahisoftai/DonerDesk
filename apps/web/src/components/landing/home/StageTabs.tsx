"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import styles from "./home.module.css";

type Stage = {
  id: string;
  label: string;
  title: string;
  summary: string;
  color: string;
  heading: string;
  statement: string;
  points: { term: string; text: string }[];
  limit?: { term: string; text: string };
  example: { caption: string; rows: { left: string; middle: string; status: { text: string; tone: "pillOk" | "pillWarn" | "pillOpen" } }[] };
};

const STAGES: Stage[] = [
  {
    id: "plan",
    label: "01 Set up",
    title: "Set the target once",
    summary: "Logframe and indicators",
    color: "var(--teal)",
    heading: "Set up the programme once",
    statement:
      "Goals, outcomes, outputs and activities, each with indicators whose baselines and targets are set once and reused in every report.",
    points: [
      { term: "Logframe and indicators.", text: "Baselines, targets and aggregation are fixed at the start. Indicators with values are archived, not deleted." },
      { term: "Team and roles.", text: "Seven roles, so each person sees and changes only the part their job needs." },
      { term: "Donor templates.", text: "Load a donor's required structure from its file once, then reuse it across grants that share it." },
    ],
    example: {
      caption: "Logframe, example",
      rows: [
        { left: "Outcome 1: Use of services", middle: "3 ind.", status: { text: "Set", tone: "pillOk" } },
        { left: "Output 1.1: Mobile clinics run", middle: "2 ind.", status: { text: "Set", tone: "pillOk" } },
        { left: "Output 1.2: Staff trained", middle: "1 ind.", status: { text: "Review", tone: "pillWarn" } },
        { left: "Activity: Clinic outreach", middle: "Linked", status: { text: "Live", tone: "pillOk" } },
      ],
    },
  },
  {
    id: "deliver",
    label: "02 Deliver",
    title: "Record it the same day",
    summary: "Activities and evidence",
    color: "var(--saffron)",
    heading: "Record the work as it happens",
    statement:
      "The person who did the activity writes it down the same day, typed or dictated. The reporting period follows from the date.",
    points: [
      { term: "Activity capture.", text: "Who, where, when and how many, in a few lines. The form fills from what the words state and never overwrites what you typed." },
      { term: "My Work.", text: "One queue across every project: what to record, what to review, what to fix." },
      { term: "Evidence library.", text: "Documents, photos and records stored in your Google Drive or in managed storage, linked to the activity they prove." },
    ],
    limit: {
      term: "Offline:",
      text: "an entry is queued on the device if the connection drops, then sent when it returns. The app itself still needs a connection to open.",
    },
    example: {
      caption: "My Work, example",
      rows: [
        { left: "Clinic outreach, Kisumu", middle: "12 Mar", status: { text: "Review", tone: "pillWarn" } },
        { left: "Training: 14 staff", middle: "18 Mar", status: { text: "Fix", tone: "pillOpen" } },
        { left: "Distribution, Ward 4", middle: "21 Mar", status: { text: "Accepted", tone: "pillOk" } },
      ],
    },
  },
  {
    id: "monitor",
    label: "03 Monitor",
    title: "See the gaps early",
    summary: "Values across periods",
    color: "var(--sky)",
    heading: "See the results while they can still change",
    statement:
      "Every indicator, every period, every recorded value in one sheet. A gap is shown as not measured, never as zero.",
    points: [
      { term: "Data Center.", text: "Values across periods with charts. Import a spreadsheet to add values, with a preview before anything is saved." },
      { term: "Roll-ups.", text: "Semi-annual, annual and final reports show the period, the life of project and percent of target side by side." },
      { term: "Rates are read as rates.", text: "A percentage indicator is judged against its baseline and target, not as a share of target." },
    ],
    example: {
      caption: "Data Center, example",
      rows: [
        { left: "Children vaccinated", middle: "1,240 / 1,500", status: { text: "83%", tone: "pillOk" } },
        { left: "Clinic visits", middle: "3,980", status: { text: "Due", tone: "pillWarn" } },
        { left: "Staff trained", middle: "Not measured", status: { text: "Gap", tone: "pillOpen" } },
      ],
    },
  },
  {
    id: "demonstrate",
    label: "04 Demonstrate",
    title: "Prove it before it's asked",
    summary: "Checks, approval and reports",
    color: "var(--coral)",
    heading: "Show what was done, and prove it",
    statement:
      "Reports, checks and approvals all draw on the same record, so a donor can be shown the evidence behind each claim.",
    points: [
      { term: "Compliance checklist.", text: "The donor's requirements, with blockers and the next step for each, weeks before the deadline." },
      { term: "Sourced drafting.", text: "Each section is drafted from your activities, indicators and evidence, with its sources shown." },
      { term: "Approval and export.", text: "A second approver when the project requires one. Export to Word, PDF, Excel or an evidence ZIP. DonorDesk does not send reports to donors." },
    ],
    example: {
      caption: "Readiness, example",
      rows: [
        { left: "Indicator values verified", middle: "18 / 24", status: { text: "Open", tone: "pillWarn" } },
        { left: "Confidentiality check", middle: "Done", status: { text: "Clear", tone: "pillOk" } },
        { left: "Second approval", middle: "Pending", status: { text: "Needed", tone: "pillOpen" } },
      ],
    },
  },
];

export function StageTabs() {
  const [selected, setSelected] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(i: number, focus = false) {
    const next = (i + STAGES.length) % STAGES.length;
    setSelected(next);
    if (focus) tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      select(i + 1, true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      select(i - 1, true);
    }
  }

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Programme stages">
        {STAGES.map((stage, i) => (
          <button
            key={stage.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${stage.id}`}
            aria-controls={`panel-${stage.id}`}
            aria-selected={selected === i}
            tabIndex={selected === i ? 0 : -1}
            className={styles.tab}
            style={{ "--c": stage.color } as CSSProperties}
            onClick={() => select(i)}
            onKeyDown={(event) => onKeyDown(event, i)}
          >
            <span className={styles.tabK}>{stage.label}</span>
            <span className={styles.tabT}>{stage.title}</span>
            <span className={styles.tabS}>{stage.summary}</span>
          </button>
        ))}
      </div>

      {STAGES.map((stage, i) => (
        <div
          key={stage.id}
          role="tabpanel"
          id={`panel-${stage.id}`}
          aria-labelledby={`tab-${stage.id}`}
          className={styles.panel}
          style={{ "--c": stage.color } as CSSProperties}
          hidden={selected !== i}
        >
          <div>
            <h3>{stage.heading}</h3>
            <p className={styles.stmt}>{stage.statement}</p>
            <ul className={styles.list}>
              {stage.points.map((point) => (
                <li key={point.term}>
                  <b>{point.term}</b> {point.text}
                </li>
              ))}
            </ul>
            {stage.limit && (
              <div className={styles.limit}>
                <b>{stage.limit.term}</b> {stage.limit.text}
              </div>
            )}
          </div>
          <aside className={styles.ui} aria-label={stage.example.caption}>
            <h4>{stage.example.caption}</h4>
            {stage.example.rows.map((row) => (
              <div key={row.left} className={styles.uiRow}>
                <span>{row.left}</span>
                <span className={styles.num}>{row.middle}</span>
                <span className={`${styles.pill} ${styles[row.status.tone]}`}>{row.status.text}</span>
              </div>
            ))}
            <p className={styles.ex}>Example data for illustration.</p>
          </aside>
        </div>
      ))}
    </>
  );
}
