# Computer-Use Automation System

This project lets an AI agent control a legacy web app that has no API, the same way a person
would: by looking at the screen and clicking and typing. The first time it does a task, an LLM
figures out the steps itself. Those steps get saved to a file so they can be replayed later
without the AI. Replay reports back whether it worked, hit a normal error (like "member not
found"), or actually failed. There's also a safety allowlist, and a way for a human to step in
if something risky is about to happen.

Full write up with design decisions: [`REPORT.md`](./REPORT.md).

The app being automated is a small mock bank back office system built for this project
(`mock-app/`). It's made to look old on purpose (plain tables, no CSS classes, no
test IDs) since that's the kind of app this is meant to handle. It has login, member search, a
member detail page with a balance, and a form to open a sub account.

## Setup

Node.js 20+ and npm.

```bash
npm install
npx playwright install chromium
```

Copy `.env.example` to `.env` and put in your own Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-your-real-key-here
```

Leave the rest of the values as they are. `MOCK_APP_USERNAME` and `MOCK_APP_PASSWORD` are just
the mock app's own login (any username works, password is fixed in `mock-app/server.ts`), not
real secrets.

## Try it

These commands are written for Windows PowerShell. In the JSON arguments, the backslashes
before the inner quotes (like `'{\"memberId\":\"12345\"}'`) are needed on PowerShell only, since
it re-parses the command to run `npm`. On macOS/Linux/bash, drop the backslashes instead:
`'{"memberId":"12345"}'`.

Start the mock app first in its own terminal:

```bash
npm run mock-app
# Mock bank app running at http://localhost:4000/
# Sign in with any username and password "demo1234"
```

**1. Let the AI figure out a task** (opens a browser window):

```bash
npm run discover -- \
  --goal "Log in with username jsmith and password demo1234, look up member 12345, and report their current savings balance." \
  --target "http://localhost:4000" \
  --name lookup-member-balance \
  --inputs '{\"memberId\":\"12345\"}' \
  --secrets '{\"MOCK_APP_PASSWORD\":\"demo1234\"}' \
  --outcomeRulesFrom artifacts/lookup-member-balance.json
```

Watch it drive the browser. It saves what happened to `evidence/discover-<id>/`, and saves what
it learned to `artifacts/lookup-member-balance.discovered.json`.

**2. Replay that same task, no AI this time:**

```bash
npm run replay -- \
  --artifact artifacts/lookup-member-balance.discovered.json \
  --params '{\"memberId\":\"12345\"}'
```

Try a member ID that doesn't exist, to see it report a clean result instead of crashing:

```bash
npm run replay -- \
  --artifact artifacts/lookup-member-balance.discovered.json \
  --params '{\"memberId\":\"99999\"}'
```

Every replay saves what happened (and a screenshot, if it wasn't a plain success) to
`evidence/replay-<id>/`.

**3. A second task** (`open-sub-account`) shows a risky action and a validation error. Replay
won't complete a risky action by default (see next section). Pass `--allowIrreversible true` to
let it go through:

```bash
# Deposit too small, a normal validation error
npm run replay -- \
  --artifact artifacts/open-sub-account.discovered.json \
  --params '{\"memberId\":\"12345\",\"initialDeposit\":\"10\"}' \
  --allowIrreversible true

# A real completed run, actually opens a sub-account
npm run replay -- \
  --artifact artifacts/open-sub-account.discovered.json \
  --params '{\"memberId\":\"23456\",\"initialDeposit\":\"250\"}' \
  --allowIrreversible true
```

**4. Human handoff.** Run a replay *without* `--allowIrreversible` on the same risky action, and
instead of finishing on its own, it pauses:

```bash
npm run replay -- \
  --artifact artifacts/open-sub-account.discovered.json \
  --params '{\"memberId\":\"12345\",\"initialDeposit\":\"250\"}'
```

The command will look stuck. That's expected. It's paused, and the browser window is still open
on the real page. In a second terminal, start the operator console:

```bash
npm run operator
# Operator console running at http://localhost:4100
```

Open `http://localhost:4100`. You'll see the paused run, why it stopped, and a link to a
screenshot of that moment. Click **Resume**, and the original `replay` command picks back up
and finishes.

## Tests

```bash
npm test        # safety policy, redaction, artifact schema
npm run typecheck
```

Replay, discovery, and the human handoff are checked against the real, live mock app during
development, not mocked out in the test suite. `/evidence/` has the actual recorded runs.

## What's where

```text
mock-app/            the app being automated
src/surface/          drives the browser: reads the page, clicks, types
src/safety/            allowlist policy and what gets hidden from logs
src/logging/            saves what happened, with sensitive data blanked out
src/artifact/            the artifact format, and turning a run into one
src/replay/               runs a saved artifact with no AI involved
src/agent/                 the AI loop that figures a task out the first time
src/escalation/             lets a human pause a run and take over
src/cli/                     the discover / replay commands
artifacts/                    saved capability files
evidence/                      real run logs and screenshots
tests/                          automated tests
```
