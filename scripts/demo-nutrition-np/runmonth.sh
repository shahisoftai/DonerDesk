#!/usr/bin/env bash
# usage: runmonth.sh <month-dir> <first-index>  : submits records first..last of a month's month.json
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/b42c08e2-1d7a-4884-bbf2-7024d89bc851/scratchpad
export DEMO_CDP=http://localhost:9360 DEMO_LOCK=$S/lock P=14d6f13d-34ee-47ef-9d64-d16595e3e690 EV=$1 SHOT=$S/a.png
N=$(python3 -c "import json;print(len(json.load(open('$1/month.json'))['records']))")
cd "$(dirname "$0")"
for ((i=${2:-0}; i<N; i++)); do rm -f $S/lock; timeout 150 node act3.mjs $i submit 2>&1 | grep -E "after|no |\?|rror|planned" | cut -c1-160; sleep 3; done
echo "MONTH_DONE $1 $N"
