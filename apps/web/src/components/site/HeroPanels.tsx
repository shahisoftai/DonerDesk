/** The right-hand panels of hero slides 2 and 3. Example data only, drawn from one invented water programme so the two slides agree. */

export function RecordPanel() {
  return (
    <>
      <div className="sx-panel-head"><b>From a phone to a target</b><span className="sx-tag">Example data</span></div>
      <ol className="sx-trail">
        <li>
          <span className="sx-trail-n">1</span>
          <div>
            <h4>Field form · Gulu district</h4>
            <p>Water points working: <b>42</b></p>
            <span className="sx-state sx-state-wait">Saved on the device · sends when the signal returns</span>
          </div>
        </li>
        <li>
          <span className="sx-trail-n">2</span>
          <div>
            <h4>Entry sheet · Quarter 2</h4>
            <p>This period <b>42</b> · Cumulative <b>118</b></p>
            <span className="sx-state sx-state-ok">Verified · evidence attached</span>
          </div>
        </li>
        <li>
          <span className="sx-trail-n">3</span>
          <div>
            <h4>Indicator against its target</h4>
            <div className="sx-bar sx-bar-wide" aria-hidden="true"><span style={{ width: "79%" }} /></div>
            <p>118 of 150 water points · <b>79%</b> of target</p>
            <p className="sx-gap">Households surveyed: <b>Not measured</b> this period</p>
          </div>
        </li>
      </ol>
    </>
  );
}

export function ReportPanel() {
  return (
    <>
      <div className="sx-panel-head"><b>Draft section · Results</b><span className="sx-tag">Example data</span></div>
      <div className="sx-draft">
        <p>
          By the end of the second quarter, <b>118</b> of the planned <b>150</b> water points were working
          <span className="sx-cite">Indicator 1.2</span>. Community committees were trained in every district
          <span className="sx-cite">Activity record, 14 May</span>.
        </p>
        <ul className="sx-checks">
          <li className="sx-check-ok">Every figure traced to the record</li>
          <li className="sx-check-ok">Statements checked against the evidence</li>
          <li className="sx-check-wait">Waiting for a person to approve</li>
        </ul>
        <div className="sx-draft-foot">
          <span>Donor template · section 3 of 8</span>
          <span>Word, PDF and Excel export</span>
        </div>
      </div>
    </>
  );
}
