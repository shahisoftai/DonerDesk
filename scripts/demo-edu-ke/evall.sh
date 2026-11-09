#!/usr/bin/env bash
cd "$(dirname "$0")"; export S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/b42c08e2-1d7a-4884-bbf2-7024d89bc851/scratchpad DEMO_CDP=http://localhost:9360 DEMO_LOCK=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/b42c08e2-1d7a-4884-bbf2-7024d89bc851/scratchpad/lock
for i in $(seq 1 22); do rm -f $S/lock; timeout 120 node evone.mjs $i $((i+1)) 2>&1 | tail -2 | cut -c1-200; done; echo ALL_DONE
