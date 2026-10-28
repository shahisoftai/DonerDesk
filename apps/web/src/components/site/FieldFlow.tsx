"use client";

import { useState } from "react";
import { LineChart } from "./charts";
import { FIELD_STEPS, SECTORS } from "./site-data";

function Scene({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="sx-phone">
        <b>Borehole inspection</b>
        <div className="sx-row"><span>Water point</span><span>WP-214</span></div>
        <div className="sx-row"><span>Working</span><span>Yes</span></div>
        <div className="sx-row"><span>People served</span><span>420</span></div>
        <div className="sx-row"><span>Photo</span><span>1 attached</span></div>
        <span className="sx-pill sx-wait">Waiting to send · offline</span>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div className="sx-kpi" style={{ border: "1px solid var(--line)", borderRadius: 12 }}>
          <small>Water points working</small><strong>91%</strong>
          <div className="sx-bar"><span style={{ width: "91%" }} /></div>
        </div>
        <div style={{ margin: "12px 0" }}><LineChart sector={SECTORS[0]!} /></div>
        <span className="sx-pill sx-ok">Sent · reviewed</span>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="sx-doc">
        <h4>Outcome 1: access to safe water</h4>
        <p>By the end of June, 48,200 people had safe access to water, 80% of the target of 60,000 <span className="sx-cite">Sheet · Q2</span>. Of 33 water points inspected, 30 were working <span className="sx-cite">Activity WP-214</span>.</p>
        <p className="sx-fine">Example draft section.</p>
      </div>
    );
  }
  return (
    <div className="sx-doc">
      <h4>Ready for review</h4>
      <p style={{ marginBottom: 8 }}>✔ Numbers match the verified record</p>
      <p style={{ marginBottom: 8 }}>✔ Every statement is supported</p>
      <p style={{ marginBottom: 14 }}>✔ Evidence attached</p>
      <span className="sx-pill sx-ok">Approved by a person · export ready</span>
    </div>
  );
}

export function FieldFlow() {
  const [step, setStep] = useState(0);
  return (
    <div className="sx-flow">
      <div className="sx-steps" role="tablist" aria-label="From the field to the donor">
        {FIELD_STEPS.map((s, i) => (
          <button key={s.title} type="button" role="tab" aria-selected={i === step} onClick={() => setStep(i)}>
            <i>{i + 1}</i><div><b>{s.title}</b><span>{s.text}</span></div>
          </button>
        ))}
      </div>
      <div className="sx-panel sx-scene" role="tabpanel" aria-live="polite"><Scene step={step} /></div>
    </div>
  );
}
