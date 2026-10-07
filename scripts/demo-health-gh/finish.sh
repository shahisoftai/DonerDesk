#!/bin/bash
m=$1; cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-health-gh; export DEMO_CDP=http://127.0.0.1:9333
node review.mjs $m | head -6 | cut -c1-260; node approvesec.mjs $m | tail -1 | cut -c1-120; node checks.mjs $m | head -2 | cut -c1-500
