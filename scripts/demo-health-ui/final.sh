#!/bin/bash
cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-health-ui
node regsum.mjs 5
sleep 20
node decide2.mjs 5 "Checked against the verified life-of-project indicator values, the monthly registers and the verified finance figures; the causal wording reflects the programme team's own close-out observations."
node finish.mjs 5 submit | tail -3
node checks.mjs 5 | head -12
node appr-report.mjs 5 | tail -2
node exportall.mjs 5 "Word document,PDF report,Indicator spreadsheet,Evidence checklist,Evidence package (ZIP)" final
echo FINALDONE
