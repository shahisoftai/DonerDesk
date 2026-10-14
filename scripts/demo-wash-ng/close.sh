#!/bin/bash
# usage: close.sh <p> [from-step]: period p values, story, verify, generate, review, approve, sign off (author + second approver), export
p=$1; from=${2:-1}; cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-wash-ng; export DEMO_CDP=http://127.0.0.1:9333
if [ $from -le 1 ]; then echo "== values"; node vals.mjs $p; node story.mjs $p; node vall.mjs $p | tail -1; fi
if [ $from -le 2 ]; then echo "== generate"; node gen.mjs $p >/dev/null 2>&1; sleep 30; node poll2.mjs $p | grep -E "DONE|ready|flagged" | head -3; fi
echo "== review"; for round in 1 2 3; do
  node review.mjs $p | grep -E "KEPT|LEFT" | cut -c1-140
  node approvesec.mjs $p | tail -1
  CH=$(node checks.mjs $p | head -2 | tr '\n' ' '); echo "CHECKS: $CH" | cut -c1-300
  echo "$CH" | grep -qE "Nothing left to fix|Only suggestions left|nothing to do" && break
  PF=$(node pref.mjs $p); echo "$PF" | cut -c1-500
  echo "PREFLIGHT NOT CLEAN"; echo CLOSESTOP $p; exit 1
done
echo "== signoff (author)"; node signoff.mjs $p 2>&1 | head -2 | cut -c1-200
echo "== signoff (second approver)"; DEMO_CDP=http://127.0.0.1:9334 node signoff.mjs $p 2>&1 | head -3 | cut -c1-200
echo "== export"; node exportfull.mjs $p "Word document" 2>&1 | tail -1 | cut -c1-260
echo CLOSEDONE $p
