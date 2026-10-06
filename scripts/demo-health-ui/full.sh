#!/bin/bash
m=$1
cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-health-ui
./month.sh $m > mo$((m+1)).log 2>&1
sleep 20
node fixfb.mjs $m > fb$((m+1)).log 2>&1
node regenmany.mjs $m "Executive Summary" "Use only this month's recorded values and the targets. Do not state cumulative totals, totals to date, or percent of target; do not say 'up from'." >> fb$((m+1)).log 2>&1
sleep 25
./close2.sh $m "Figures agree with the verified indicator values entered for this month; the wording restates recorded results." > c$((m+1)).log 2>&1
echo FULLDONE >> c$((m+1)).log
