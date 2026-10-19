#!/bin/bash
# usage: month.sh <m>: the month's planning decisions, completed activities (with files), review, evidence, planned items done
m=$1; cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-nepal-cmam; export DEMO_CDP=http://127.0.0.1:9333
echo "== pre"; node plan-ops.mjs $m pre | tail -4 | cut -c1-200
echo "== acts"; WITHFILES=1 node actcreate.mjs $m | cut -c1-140
echo "== accept"; node accept-acts.mjs "Month $((m+1)) records checked against registers and delivery notes; accepted." | tail -1 | cut -c1-100
echo "== verify evidence"; node verify-ev.mjs 30 | tail -1
echo "== post"; node plan-ops.mjs $m post | tail -1
echo MONTHDONE $m
