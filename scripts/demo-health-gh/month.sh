#!/bin/bash
# usage: month.sh <m> [from-step]   steps: 1 acts, 2 evidence, 3 accept+verify, 4 values+story, 5 generate
m=$1; from=${2:-1}; cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-health-gh; export DEMO_CDP=http://127.0.0.1:9333
MNAME=$(node -e 'import("./plan7.mjs").then(x=>console.log(x.MN['$m']))')
[ $from -le 1 ] && { echo "== acts"; node actcreate.mjs $m | tail -2 | cut -c1-120; }
[ $from -le 2 ] && { echo "== evidence"; node evup.mjs $m | tail -2; }
[ $from -le 3 ] && { echo "== accept/verify"; node accept-acts.mjs "$MNAME records checked against registers and attendance sheets; accepted." | tail -1; node verify-ev.mjs | tail -1; }
[ $from -le 4 ] && { echo "== values"; node vals.mjs $m; node story.mjs $m; node vall.mjs $m | tail -1; }
[ $from -le 5 ] && { echo "== generate"; node gen.mjs $m >/dev/null 2>&1; sleep 25; node poll2.mjs $m | grep -E "DONE"; }
echo MONTHGEN $m
