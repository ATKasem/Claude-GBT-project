import test from "node:test";
import assert from "node:assert/strict";
import { appendTurn, formatLocalTimestamp } from "../src/shared-file.ts";

const baseMarkdown = `# Claudegbtproject

## Current Goal
Build the thin slice.

## Task Board
- [ ] Ship CLI.

## Progress Log
### 2026-07-04 01:00 -05:00 - Cody
- Existing entry.

## Conversation
### 2026-07-04 01:00 -05:00 - Cody:
Existing message.

## Ideas / Improvements
- Keep parsing deterministic.

## Decisions Made
- Use shared.md.

## Next Steps
- Run tests.
`;

test("formatLocalTimestamp includes local UTC offset", () => {
  const timestamp = formatLocalTimestamp(new Date("2026-07-04T06:30:00.000Z"));

  assert.match(timestamp, /^2026-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/);
});

test("appendTurn records status marker, latest progress, and conversation turn", () => {
  const updated = appendTurn(baseMarkdown, {
    agent: "Cody",
    status: "needs_user",
    message: "Need confirmation.",
    timestamp: "2026-07-04 01:31 -05:00",
  });

  assert.match(updated, /ORCHESTRATOR_STATUS: needs_user/);
  assert.match(updated, /## Progress Log\n### 2026-07-04 01:31 -05:00 - Cody/);
  assert.match(updated, /### 2026-07-04 01:31 -05:00 - Cody:\nNeed confirmation\./);
  assert.ok(updated.indexOf("### 2026-07-04 01:31 -05:00 - Cody:") < updated.indexOf("## Ideas / Improvements"));
});
