import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setStatusMarker, type OrchestratorStatus } from "./status.ts";

export const DEFAULT_SHARED_FILE = "shared.md";

export type TurnInput = {
  agent: string;
  status: OrchestratorStatus;
  message: string;
  timestamp?: string;
};

export function resolveSharedFilePath(filePath = DEFAULT_SHARED_FILE): string {
  return resolve(process.cwd(), filePath);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readSharedFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function writeSharedFile(filePath: string, markdown: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, markdown, "utf8");
}

export async function initializeSharedFile(filePath: string, template: string): Promise<boolean> {
  if (await fileExists(filePath)) {
    return false;
  }

  await writeSharedFile(filePath, template);
  return true;
}

export function appendTurn(markdown: string, input: TurnInput): string {
  validateAgentName(input.agent);

  const message = input.message.trim();
  if (message.length === 0) {
    throw new Error("Turn message cannot be empty.");
  }

  const timestamp = input.timestamp ?? formatLocalTimestamp();
  const markdownWithStatus = setStatusMarker(markdown, input.status);
  const progressEntry = [
    `### ${timestamp} - ${input.agent}`,
    `- Status: \`${input.status}\``,
    "- Updated shared state through `cgbt turn`.",
  ].join("\n");
  const conversationEntry = [`### ${timestamp} - ${input.agent}:`, message].join("\n");

  return insertBeforeSection(
    insertAfterSectionHeading(markdownWithStatus, "Progress Log", progressEntry),
    "Ideas / Improvements",
    conversationEntry,
  );
}

export function formatLocalTimestamp(date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffsetMinutes / 60);
  const remainingOffsetMinutes = absoluteOffsetMinutes % 60;

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    `${offsetSign}${pad(offsetHours)}:${pad(remainingOffsetMinutes)}`,
  ].join(" ");
}

function insertAfterSectionHeading(markdown: string, sectionName: string, content: string): string {
  const lines = splitLines(markdown);
  const sectionIndex = findSectionIndex(lines, sectionName);

  if (sectionIndex === -1) {
    throw new Error(`Cannot find required section: ## ${sectionName}`);
  }

  lines.splice(sectionIndex + 1, 0, content.trimEnd(), "");
  return lines.join("\n");
}

function insertBeforeSection(markdown: string, sectionName: string, content: string): string {
  const lines = splitLines(markdown);
  const sectionIndex = findSectionIndex(lines, sectionName);

  if (sectionIndex === -1) {
    throw new Error(`Cannot find required section: ## ${sectionName}`);
  }

  lines.splice(sectionIndex, 0, content.trimEnd(), "");
  return lines.join("\n");
}

function findSectionIndex(lines: string[], sectionName: string): number {
  return lines.findIndex((line) => line.trim() === `## ${sectionName}`);
}

function validateAgentName(agent: string): void {
  if (!/^[A-Za-z][A-Za-z0-9 _-]{0,63}$/.test(agent)) {
    throw new Error("Agent name must start with a letter and contain only letters, numbers, spaces, underscores, or hyphens.");
  }
}

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n");
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
