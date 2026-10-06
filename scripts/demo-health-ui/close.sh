#!/bin/bash
# usage: close.sh <monthIndex> ; review flags -> approve -> submit -> approve -> export
m=$1
node decide.mjs $m
node regsum.mjs $m
node finish.mjs $m submit
node appr-report.mjs $m | tail -3
node exportall.mjs $m "Word document,PDF report,Indicator spreadsheet,Evidence checklist"
echo CLOSED
