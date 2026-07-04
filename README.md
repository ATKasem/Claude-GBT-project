# Claude GBT Project

Claude GBT Project is an early prototype for coordinating multiple AI coding agents through a shared project-state file.

The project started as a real collaboration workflow between two agents:

- **Clouse**: the Claude-side agent.
- **Cody**: the Codex-side agent.
- **Matt**: a Claude-side executive reviewer used to stress-test decisions.

The product goal is to turn that workflow into a reusable local CLI that other developers can use when multiple AI agents need to stay aligned on one codebase.

## What Problem This Solves

When multiple AI coding agents work on the same project, state gets scattered across terminal history, chat transcripts, editor tabs, and repeated prompts. That creates predictable failure modes:

- agents lose track of decisions;
- task ownership gets fuzzy;
- progress updates are hard to scan;
- handoffs are copied manually;
- concurrent edits can silently overwrite each other;
- no deterministic tool can tell whether the project is waiting, continuing, or done.

This repo experiments with a simple coordination model: keep one canonical `shared.md` file, then build deterministic tooling around it before adding any model orchestration.

## Current Status

The first CLI slice is implemented:

- `cgbt init`: creates a starter `shared.md` file when one does not exist.
- `cgbt status`: reads a shared markdown file and prints the current goal, status marker, open tasks, latest progress, next steps, and validation warnings.
- `cgbt turn`: appends a timestamped progress entry and conversation turn, and updates `ORCHESTRATOR_STATUS`.

The implementation is intentionally local and deterministic. It does not call AI models, spawn agents, run a server, or orchestrate unattended loops yet.

## Requirements

- Node.js `>=24.0.0`
- npm

This prototype currently runs TypeScript directly with Node 24's built-in TypeScript support. There is no build step and no runtime dependency install required.

That Node 24 requirement is a deliberate prototype tradeoff, not a settled product decision. A future version may add a compile step for broader Node compatibility.

## Quick Start

Run the test suite:

```bash
npm test
```

Print the status of the current shared file:

```bash
npm run status
```

Or call the CLI directly:

```bash
node src/cli.ts status --file shared.md
```

Create a shared file in another project:

```bash
node src/cli.ts init --file shared.md
```

Append an agent turn:

```bash
node src/cli.ts turn --file shared.md --agent Cody --status continue --message "Implemented the next slice."
```

Valid statuses are:

- `continue`
- `needs_user`
- `done`

## Repository Layout

```text
src/
  cli.ts              Command parsing and CLI dispatch
  parser.ts           Shared markdown parsing and validation warnings
  shared-file.ts      Shared file reads, writes, initialization, and turn appends
  status.ts           ORCHESTRATOR_STATUS validation and mutation
  templates/
    shared.md         Starter shared-state template
test/
  cli.test.ts         End-to-end CLI file I/O test
  parser.test.ts      Shared markdown parser tests
  shared-file.test.ts Shared file mutation tests
shared.md             Live project coordination record
```

## How The Shared File Works

`shared.md` is the canonical coordination surface. It records:

- current goal;
- task board;
- progress log;
- conversation between agents;
- ideas and improvements;
- decisions made;
- next steps;
- `ORCHESTRATOR_STATUS`.

New conversation replies should use timestamped headings:

```markdown
### YYYY-MM-DD HH:mm -05:00 - Cody:
Message text.
```

The conversation section is append-only and ordered oldest-to-newest. The progress log is newest-first.

## Important Boundaries

The current project uses strict ownership boundaries:

- Cody may work on the CLI, root project files, tests, and `shared.md`.
- Cody must not edit Clouse/Matt-owned files.
- Clouse/Matt must not edit Cody-owned files.
- `shared.md` is the only shared handoff surface.

These boundaries are part of the experiment because cross-agent file ownership is one of the core risks this tool is meant to make explicit.

## What Is Not Built Yet

The project does not yet include:

- a real orchestrator loop;
- model invocation;
- locking or merge conflict protection;
- packaged distribution;
- a stable parser API;
- a production-ready viewer.

The next engineering work should harden parser behavior, improve `status` warning UX, document command examples, and only then consider model orchestration.
