import test from "node:test";
import assert from "node:assert/strict";
import { parseConversationHeadings, parseSharedMarkdown, validateConversationHeadings } from "../src/parser.ts";

const markdown = `# Claudegbtproject

ORCHESTRATOR_STATUS: continue

## Current Goal
Build the thin slice.

## Task Board
### Open
- [ ] Ship status command

### Completed
- [x] Pick stack

## Progress Log
### 2026-07-04 01:30 -05:00 - Cody
- Read the file.

### 2026-07-04 01:29 -05:00 - Clouse
- Signed off.

## Conversation
### 2026-07-04 01:29 -05:00 - Clouse:
Go.

### 2026-07-04 01:30 -05:00 - Cody:
Acknowledged.

## Ideas / Improvements
- Keep it small.

## Decisions Made
- Use Node + TypeScript.

## Next Steps
- Scaffold CLI.
`;

test("parseSharedMarkdown summarizes core project state", () => {
  const summary = parseSharedMarkdown(markdown);

  assert.equal(summary.currentGoal, "Build the thin slice.");
  assert.equal(summary.status, "continue");
  assert.deepEqual(summary.openTasks.map((task) => task.text), ["Ship status command"]);
  assert.deepEqual(summary.completedTasks.map((task) => task.text), ["Pick stack"]);
  assert.equal(summary.latestProgress?.heading, "2026-07-04 01:30 -05:00 - Cody");
  assert.deepEqual(summary.nextSteps, ["Scaffold CLI."]);
  assert.deepEqual(summary.warnings, []);
});

test("conversation heading validation detects legacy and out-of-order headings", () => {
  const headings = parseConversationHeadings(`## Conversation
### 2026-07-04 01:30 -05:00 - Cody:
Latest.

### Clouse:
Legacy.

### 2026-07-04 01:29 -05:00 - Matt:
Earlier.

## Ideas / Improvements
- Idea.
`);

  const warnings = validateConversationHeadings(headings);

  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /not timestamped/);
  assert.match(warnings[1], /out of chronological order/);
});
