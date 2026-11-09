#!/usr/bin/env bash
# usage: finishmonth.sh <month-dir> <periodId>
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/b42c08e2-1d7a-4884-bbf2-7024d89bc851/scratchpad
export DEMO_CDP=http://localhost:9360 DEMO_LOCK=$S/lock; cd "$(dirname "$0")"
rm -f $S/lock; node acceptall.mjs 2>&1 | tail -2
rm -f $S/lock; node vals.mjs "$1" "$2" 2>&1 | tail -6
echo "FINISH_DONE $1"
