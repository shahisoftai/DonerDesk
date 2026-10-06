# demo-ui

Shared harness for the browser demo and verification scripts (Phase 25.0).

1. Start one visible Chromium with `--remote-debugging-port=9333` and log in (it stays open for the whole session).
2. `DEMO_BASE=https://donordesk.online node scripts/demo-ui/phase25-check.mjs`

`lib.mjs` gives every script: `attach(name)` (refuses to start when another script holds the page: the run lock),
`waitForUi(page, predicate)` (waits for what the UI shows, never a fixed sleep) and `step(name, fn)` (logs duration, names
the failing step). Credentials are never written here: log in by hand or pass them in the environment of the one command.
