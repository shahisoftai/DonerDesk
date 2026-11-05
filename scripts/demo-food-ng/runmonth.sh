#!/usr/bin/env bash
# usage: runmonth.sh <month-dir> <first-index>  : submits records first..last of a month's month.json
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/be45a413-f262-4b9b-982d-87cd3df8b366/scratchpad
export DEMO_CDP=http://localhost:9350 DEMO_LOCK=$S/lock P=40d65f44-d771-4ee6-9edf-4c34a4cab5ac EV=$1 SHOT=$S/a.png
N=$(python3 -c "import json;print(len(json.load(open('$1/month.json'))['records']))")
for ((i=${2:-0}; i<N; i++)); do rm -f $S/lock; cd "$(dirname "$0")"; node act2.mjs $i submit 2>&1 | grep -E "after|\?|rror" ; sleep 4; done
echo "MONTH_DONE $1 $N"
