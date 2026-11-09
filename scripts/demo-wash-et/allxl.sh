#!/usr/bin/env bash
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/b42c08e2-1d7a-4884-bbf2-7024d89bc851/scratchpad
cd "$(dirname "$0")"; export S DEMO_CDP=http://localhost:9360 DEMO_LOCK=$S/lock
for pair in 2026-02:0e7c6971-46a3-4681-a323-77bbb4bcb3b8 2026-03:1e9631af-91cd-49e1-817b-e1779e40826e 2026-04:b849606d-9bfa-41bb-a1c8-abb650d93999 2026-05:eb89a6a6-0304-4be9-96f9-b2c62305b6b0 2026-06:3d4270c2-54bc-418b-9bc2-5ebed5880276 2026-07:fdaa85df-0241-493a-a718-eb0e9f00bac5; do
  m=${pair%%:*}; p=${pair#*:}; rm -f $S/lock; echo "== $m"; timeout 170 node xlmonth.mjs $m $p 2>&1 | tail -6 | cut -c1-200; echo "MONTH_FINISHED $m"
done; echo ALL_DONE
