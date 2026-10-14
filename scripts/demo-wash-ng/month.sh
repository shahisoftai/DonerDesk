#!/bin/bash
# usage: month.sh <m> : month m activities (with files), accept, verify evidence
m=$1; cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-wash-ng; export DEMO_CDP=http://127.0.0.1:9333
MNAME=$(node -e 'import("./plan8.mjs").then(x=>console.log(x.MN['$m']))')
echo "== acts"; WITHFILES=1 node actcreate.mjs $m | cut -c1-140
echo "== accept/verify"; node accept-acts.mjs "$MNAME records checked against registers and attendance sheets; accepted." | tail -1; node verify-ev.mjs | tail -1
echo MONTHDONE $m
