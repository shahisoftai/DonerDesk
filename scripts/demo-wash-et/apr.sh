#!/usr/bin/env bash
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/be45a413-f262-4b9b-982d-87cd3df8b366/scratchpad
cd "$(dirname "$0")"
./runmonth.sh $S/mo/2027-04 0 && ./finishmonth.sh $S/mo/2027-04 62fb4456-feba-4b5b-b5da-6097a4198430
echo ALL_DONE
