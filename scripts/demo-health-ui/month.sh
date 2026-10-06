#!/bin/bash
m=$1
cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-health-ui
echo "== acts"; NOFILES=1 node actcreate.mjs $m all
echo "== evidence"; node evup.mjs $m
echo "== accept/verify"; node accept-acts.mjs "Month $((m+1)) records checked against registers and attendance sheets; accepted." | head -3
node verify-ev.mjs | tail -1
echo "== values"; node vals.mjs $m; node story.mjs $m; node vall.mjs $m | tail -2
echo "== generate"; node gen.mjs $m >/dev/null 2>&1; sleep 20; node poll2.mjs $m | grep -E "DONE|ready"
echo MONTHGEN
