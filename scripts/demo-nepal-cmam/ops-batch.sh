#!/bin/bash
cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-nepal-cmam; export DEMO_CDP=http://127.0.0.1:9333
echo "== verify evidence"; node verify-ev.mjs 60 | tail -1
for m in 2 5 6; do echo "== pre $m"; node plan-ops.mjs $m pre | tail -6 | cut -c1-200; done
for m in 2 3 4 5 6; do echo "== post $m"; node plan-ops.mjs $m post | tail -1; done
echo OPSDONE
