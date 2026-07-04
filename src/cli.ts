#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendTurn, initializeSharedFile, readSharedFile, resolveSharedFilePath, writeSharedFile } from "./shared-file.ts";
import { parseSharedMarkdown } from "./parser.ts";
import { parseOrchestratorStatus } from "./status.ts";

type Output = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
};

type ParsedArgs = {
  command: string | null;
  options: Map<string, string | true>;
};

const HELP_TEXT = `Usage:
  cgbt init [--file shared.md]
  cgbt status [--file shared.md]
  cgbt turn --agent <name> --status <continue|needs_user|done> --message <text> [--file shared.md]
`;

export async function main(argv = process.argv.slice(2), output: Output = process): Promise<number> {
  try {
    const parsedArgs = parseArgs(argv);

    switch (parsedArgs.command) {
      case "init":
        await runInit(parsedArgs, output);
        return 0;
      case "status":
        await runStatus(parsedArgs, output);
        return 0;
      case "turn":
        await runTurn(parsedArgs, output);
        return 0;
      case "help":
      case null:
        output.stdout.write(HELP_TEXT);
        return 0;
      default:
        throw new Error(`Unknown command "${parsedArgs.command}".\n\n${HELP_TEXT}`);
    }
  } catch (error) {
    output.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = null, ...tokens] = argv;
  const options = new Map<string, string | true>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument "${token}".`);
    }

    const name = token.slice(2);
    const nextToken = tokens[index + 1];

    if (!nextToken || nextToken.startsWith("--")) {
      options.set(name, true);
      continue;
    }

    options.set(name, nextToken);
    index += 1;
  }

  return { command, options };
}

async function runInit(parsedArgs: ParsedArgs, output: Output): Promise<void> {
  const filePath = getSharedFilePath(parsedArgs);
  const template = await readFile(new URL("./templates/shared.md", import.meta.url), "utf8");
  const created = await initializeSharedFile(filePath, template);

  output.stdout.write(created ? `Created ${filePath}\n` : `Shared file already exists: ${filePath}\n`);
}

async function runStatus(parsedArgs: ParsedArgs, output: Output): Promise<void> {
  const filePath = getSharedFilePath(parsedArgs);
  const markdown = await readSharedFile(filePath);
  const summary = parseSharedMarkdown(markdown);
  output.stdout.write(renderStatus(summary));
}

async function runTurn(parsedArgs: ParsedArgs, output: Output): Promise<void> {
  const filePath = getSharedFilePath(parsedArgs);
  const agent = requireStringOption(parsedArgs, "agent");
  const status = parseOrchestratorStatus(requireStringOption(parsedArgs, "status"));
  const message = requireStringOption(parsedArgs, "message");
  const markdown = await readSharedFile(filePath);
  const updatedMarkdown = appendTurn(markdown, { agent, status, message });

  await writeSharedFile(filePath, updatedMarkdown);
  output.stdout.write(`Recorded ${agent} turn with status ${status} in ${filePath}\n`);
}

function renderStatus(summary: ReturnType<typeof parseSharedMarkdown>): string {
  const lines = [
    "Current Goal:",
    indent(summary.currentGoal || "(missing)"),
    "",
    `Orchestrator Status: ${summary.status ?? "(missing)"}`,
    "",
    `Open Tasks (${summary.openTasks.length}):`,
    ...renderList(summary.openTasks.map((task) => task.text)),
    "",
    "Latest Progress:",
    summary.latestProgress
      ? indent(`### ${summary.latestProgress.heading}\n${summary.latestProgress.body}`)
      : indent("(missing)"),
    "",
    `Next Steps (${summary.nextSteps.length}):`,
    ...renderList(summary.nextSteps),
  ];

  if (summary.warnings.length > 0) {
    lines.push("", `Warnings (${summary.warnings.length}):`, ...renderList(summary.warnings));
  }

  return `${lines.join("\n")}\n`;
}

function renderList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- (none)"];
}

function indent(value: string): string {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function getSharedFilePath(parsedArgs: ParsedArgs): string {
  const fileOption = parsedArgs.options.get("file");
  return resolveSharedFilePath(typeof fileOption === "string" ? fileOption : undefined);
}

function requireStringOption(parsedArgs: ParsedArgs, name: string): string {
  const value = parsedArgs.options.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required option --${name}.`);
  }

  return value;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
