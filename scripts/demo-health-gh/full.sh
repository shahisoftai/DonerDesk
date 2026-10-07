#!/bin/bash
# usage: full.sh <m> [from-step]: month data + generate, review, auto-fix lint blockers by regenerating the named section, approve, sign off, export
m=$1; from=${2:-1}; cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-health-gh; export DEMO_CDP=http://127.0.0.1:9333
[ $from -le 5 ] && ./month.sh $m $from
echo "== review"; for round in 1 2 3; do
  node review.mjs $m | grep -E "KEPT|LEFT" | cut -c1-140
  node approvesec.mjs $m | tail -1
  CH=$(node checks.mjs $m | head -2 | tr '\n' ' '); echo "CHECKS: $CH" | cut -c1-300
  echo "$CH" | grep -qE "Nothing left to fix|you can submit" && break
  PF=$(node pref.mjs $m); echo "$PF" | cut -c1-500
  SEC=$(echo "$PF" | sed -e 's/^PREFLIGHT: //' | cut -d: -f1)
  if echo "$PF" | grep -q "different figures"; then echo "regen '$SEC'"; node regen.mjs $m "$SEC" "Do not use the words 'targeted' or 'to date' and do not follow a number with them; write 'against a target of N' and 'life-of-Action total' instead. Say 'during the month' for monthly totals." >/dev/null 2>&1; sleep 50; else echo "UNKNOWN BLOCKER"; echo MONTHSTOP $m; exit 1; fi
done
echo "$CH" | grep -qE "Nothing left to fix|you can submit" || { echo "BLOCKED $m"; echo FULLDONE $m; exit 1; }
node signoff.mjs $m 2>/dev/null | head -1 | cut -c1-120
node exportfull.mjs $m "Word document" 2>&1 | tail -1 | cut -c1-260
echo FULLDONE $m
