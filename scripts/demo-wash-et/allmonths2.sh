#!/usr/bin/env bash
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/b42c08e2-1d7a-4884-bbf2-7024d89bc851/scratchpad
cd "$(dirname "$0")"
export DEMO_CDP=http://localhost:9360 DEMO_LOCK=$S/lock
declare -A PID=( [2026-12]=0b4c8842-59cd-4650-8140-99e0f7ef344e [2027-01]=bf4ea326-f877-4bfb-9d59-e08e63dd3f76 [2027-02]=064ad3b8-e6e0-4501-a62f-736d0e251989 [2027-03]=607f5698-0185-402d-9b43-d3d992c0f0c0 [2027-04]=0c7387a8-805b-499f-8496-4d63b8267d56 )
for m in 2026-12 2027-01 2027-02 2027-03 2027-04; do
  echo "== $m records"; ./runmonth.sh $S/months/$m 0
  rm -f $S/lock; echo "== $m accept"; timeout 120 node acceptall.mjs 2>&1 | tail -2
  rm -f $S/lock; echo "== $m values"; timeout 170 node vals.mjs $S/months/$m ${PID[$m]} 2>&1 | grep -E "verified|rror" | head -3
  echo "MONTH_FINISHED $m"
done
echo ALL_DONE
