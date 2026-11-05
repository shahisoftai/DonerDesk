#!/usr/bin/env bash
# usage: finishmonth.sh <month-dir> <periodId>
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/be45a413-f262-4b9b-982d-87cd3df8b366/scratchpad
export DEMO_CDP=http://localhost:9350 DEMO_LOCK=$S/lock; cd "$(dirname "$0")"
rm -f $S/lock; node acceptall.mjs 2>&1 | tail -2
rm -f $S/lock; node vals.mjs "$1" "$2" 2>&1 | tail -6
echo "FINISH_DONE $1"
