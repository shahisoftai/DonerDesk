#!/bin/bash
# The field officer (second window) enters the completed activities of months 2..7; the project manager window accepts them.
cd /home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-nepal-cmam; export DEMO_CDP=http://127.0.0.1:9334 DEMO_LOCK=/tmp/dd9-ram.lock
for m in "$@"; do echo "== records month $m"; WITHFILES=1 node actcreate.mjs $m | cut -c1-140; echo RAMDONE $m; done
