#!/usr/bin/env bash
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/be45a413-f262-4b9b-982d-87cd3df8b366/scratchpad
cd "$(dirname "$0")"
./runmonth.sh $S/mo/2027-01 0 && ./finishmonth.sh $S/mo/2027-01 7b5c59f7-2f6f-4cf4-ba11-882bada88fe7
./runmonth.sh $S/mo/2027-02 0 && ./finishmonth.sh $S/mo/2027-02 f2761691-675b-432a-9d3f-eec1fc2bb0c4
./runmonth.sh $S/mo/2027-03 0 && ./finishmonth.sh $S/mo/2027-03 2be60f5e-9bd1-409e-a18f-3ce14918026a
echo ALL_DONE
