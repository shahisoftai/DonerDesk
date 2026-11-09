#!/usr/bin/env bash
S=/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/b42c08e2-1d7a-4884-bbf2-7024d89bc851/scratchpad
cd "$(dirname "$0")"; export S DEMO_CDP=http://localhost:9360 DEMO_LOCK=$S/lock
for pair in 2026-03:af13d678-d5cd-4437-a0bb-fad7b04e896b 2026-04:7cfef482-4d55-4e33-99f1-beb005acc6b4 2026-05:77a5cdc6-e2de-432a-ab2a-20b24d974d2d 2026-06:2322a8cd-dedc-44e8-8679-648f5e44a64e 2026-07:b31e987c-08db-4c41-af79-8ac33d39945e 2026-08:a46fa895-78db-48ec-a95f-c3c3ade94418; do
  m=${pair%%:*}; p=${pair#*:}; rm -f $S/lock; echo "== $m"; timeout 170 node xlmonth.mjs $m $p 2>&1 | tail -6 | cut -c1-200; echo "MONTH_FINISHED $m"
done; echo ALL_DONE
