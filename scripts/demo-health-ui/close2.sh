#!/bin/bash
m=$1; note="$2"
node decide.mjs $m "$note"
node finish.mjs $m submit
node checks.mjs $m | head -8
node appr-report.mjs $m | tail -2
node exportall.mjs $m "Word document,PDF report,Indicator spreadsheet,Evidence checklist"
echo CLOSED
