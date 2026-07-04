import { readStatusMarker, type OrchestratorStatus } from "./status.ts";

export type TaskItem = {
  checked: boolean;
  text: string;
  group: string | null;
};

export type ProgressEntry = {
  heading: string;
  body: string;
};

export type ConversationHeading = {
  rawHeading: string;
  speaker: string | null;
  timestamp: string | null;
  timestampMillis: number | null;
  lineNumber: number;
};

export type SharedSummary = {
  currentGoal: string;
  status: OrchestratorStatus | null;
  openTasks: TaskItem[];
  completedTasks: TaskItem[];
  latestProgress: ProgressEntry | null;
  nextSteps: string[];
  warnings: string[];
};

type SectionRange = {
  body: string;
  startLine: number;
  endLine: number;
};

const SECTION_HEADING_PATTERN = /^## .+$/;
const SUBSECTION_HEADING_PATTERN = /^###\s+(.+)$/;
const TASK_PATTERN = /^-\s+\[( |x|X)\]\s+(.+)$/;
const BULLET_PATTERN = /^-\s+(.+)$/;
const TIMESTAMPED_CONVERSATION_PATTERN =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}) - ([^:]+):$/;
const LEGACY_CONVERSATION_PATTERN = /^(Clouse|Cody|Matt):$/;

export function parseSharedMarkdown(markdown: string): SharedSummary {
  const statusMarker = readStatusMarker(markdown);
  const tasks = parseTasks(getSection(markdown, "Task Board")?.body ?? "");
  const conversationHeadings = parseConversationHeadings(markdown);
  const conversationWarnings = validateConversationHeadings(conversationHeadings);

  return {
    currentGoal: cleanBlock(getSection(markdown, "Current Goal")?.body ?? ""),
    status: statusMarker.status,
    openTasks: tasks.filter((task) => !task.checked),
    completedTasks: tasks.filter((task) => task.checked),
    latestProgress: parseLatestProgress(getSection(markdown, "Progress Log")?.body ?? ""),
    nextSteps: parseBullets(getSection(markdown, "Next Steps")?.body ?? ""),
    warnings: [statusMarker.warning, ...conversationWarnings].filter(Boolean) as string[],
  };
}

export function getSection(markdown: string, name: string): SectionRange | null {
  const lines = splitLines(markdown);
  const heading = `## ${name}`;
  const startIndex = lines.findIndex((line) => line.trim() === heading);

  if (startIndex === -1) {
    return null;
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (SECTION_HEADING_PATTERN.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  return {
    body: lines.slice(startIndex + 1, endIndex).join("\n"),
    startLine: startIndex + 1,
    endLine: endIndex,
  };
}

export function parseTasks(taskBoardMarkdown: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  let currentGroup: string | null = null;

  for (const line of splitLines(taskBoardMarkdown)) {
    const subsectionMatch = line.match(SUBSECTION_HEADING_PATTERN);
    if (subsectionMatch) {
      currentGroup = subsectionMatch[1].trim();
      continue;
    }

    const taskMatch = line.match(TASK_PATTERN);
    if (!taskMatch) {
      continue;
    }

    tasks.push({
      checked: taskMatch[1].toLowerCase() === "x",
      text: taskMatch[2].trim(),
      group: currentGroup,
    });
  }

  return tasks;
}

export function parseLatestProgress(progressMarkdown: string): ProgressEntry | null {
  const lines = splitLines(progressMarkdown);
  const headingIndex = lines.findIndex((line) => line.startsWith("### "));

  if (headingIndex === -1) {
    return null;
  }

  let endIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("### ")) {
      endIndex = index;
      break;
    }
  }

  return {
    heading: lines[headingIndex].replace(/^###\s+/, "").trim(),
    body: cleanBlock(lines.slice(headingIndex + 1, endIndex).join("\n")),
  };
}

export function parseConversationHeadings(markdown: string): ConversationHeading[] {
  const conversation = getSection(markdown, "Conversation");

  if (!conversation) {
    return [];
  }

  return splitLines(conversation.body).flatMap((line, index) => {
    if (!line.startsWith("### ")) {
      return [];
    }

    const rawHeading = line.replace(/^###\s+/, "").trim();
    const timestampedMatch = rawHeading.match(TIMESTAMPED_CONVERSATION_PATTERN);

    if (timestampedMatch) {
      const timestamp = timestampedMatch[1];
      return [
        {
          rawHeading,
          speaker: timestampedMatch[2].trim(),
          timestamp,
          timestampMillis: parseTimestampMillis(timestamp),
          lineNumber: conversation.startLine + index + 1,
        },
      ];
    }

    const legacyMatch = rawHeading.match(LEGACY_CONVERSATION_PATTERN);

    return [
      {
        rawHeading,
        speaker: legacyMatch ? legacyMatch[1] : null,
        timestamp: null,
        timestampMillis: null,
        lineNumber: conversation.startLine + index + 1,
      },
    ];
  });
}

export function validateConversationHeadings(headings: ConversationHeading[]): string[] {
  const warnings: string[] = [];
  let previousTimestampMillis: number | null = null;

  for (const heading of headings) {
    if (heading.timestamp === null) {
      warnings.push(`Conversation heading at line ${heading.lineNumber} is not timestamped: ### ${heading.rawHeading}`);
      continue;
    }

    if (heading.timestampMillis === null || Number.isNaN(heading.timestampMillis)) {
      warnings.push(`Conversation heading at line ${heading.lineNumber} has an invalid timestamp: ${heading.timestamp}`);
      continue;
    }

    if (previousTimestampMillis !== null && heading.timestampMillis < previousTimestampMillis) {
      warnings.push(`Conversation heading at line ${heading.lineNumber} is out of chronological order: ${heading.timestamp}`);
    }

    previousTimestampMillis = heading.timestampMillis;
  }

  return warnings;
}

export function parseBullets(markdown: string): string[] {
  return splitLines(markdown).flatMap((line) => {
    const match = line.match(BULLET_PATTERN);
    return match ? [match[1].trim()] : [];
  });
}

function parseTimestampMillis(timestamp: string): number {
  const isoTimestamp = timestamp.replace(" ", "T").replace(" ", ":00");
  return Date.parse(isoTimestamp);
}

function cleanBlock(value: string): string {
  return value.trim().replace(/\n{3,}/g, "\n\n");
}

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n");
}
