#!/bin/sh
export DEMO_CDP=http://localhost:9360 DEMO_LOCK=/tmp/claude-1000/demo50.lock
exec node "$@"
