export const VALID_ORCHESTRATOR_STATUSES = ["continue", "needs_user", "done"] as const;

export type OrchestratorStatus = (typeof VALID_ORCHESTRATOR_STATUSES)[number];

export type StatusMarkerRead = {
  status: OrchestratorStatus | null;
  rawValue: string | null;
  warning: string | null;
};

const STATUS_MARKER_PATTERN = /^ORCHESTRATOR_STATUS:\s*(\S+)\s*$/m;

export function isOrchestratorStatus(value: string): value is OrchestratorStatus {
  return VALID_ORCHESTRATOR_STATUSES.includes(value as OrchestratorStatus);
}

export function parseOrchestratorStatus(value: string): OrchestratorStatus {
  if (isOrchestratorStatus(value)) {
    return value;
  }

  throw new Error(
    `Invalid status "${value}". Expected one of: ${VALID_ORCHESTRATOR_STATUSES.join(", ")}.`,
  );
}

export function readStatusMarker(markdown: string): StatusMarkerRead {
  const match = markdown.match(STATUS_MARKER_PATTERN);

  if (!match) {
    return {
      status: null,
      rawValue: null,
      warning: "Missing ORCHESTRATOR_STATUS marker.",
    };
  }

  const rawValue = match[1];

  if (!isOrchestratorStatus(rawValue)) {
    return {
      status: null,
      rawValue,
      warning: `Invalid ORCHESTRATOR_STATUS "${rawValue}". Expected one of: ${VALID_ORCHESTRATOR_STATUSES.join(", ")}.`,
    };
  }

  return {
    status: rawValue,
    rawValue,
    warning: null,
  };
}

export function setStatusMarker(markdown: string, status: OrchestratorStatus): string {
  const marker = `ORCHESTRATOR_STATUS: ${status}`;

  if (STATUS_MARKER_PATTERN.test(markdown)) {
    return markdown.replace(STATUS_MARKER_PATTERN, marker);
  }

  const lines = splitLines(markdown);
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));

  if (titleIndex === -1) {
    return `${marker}\n\n${markdown}`;
  }

  const insertIndex = titleIndex + 1;
  lines.splice(insertIndex, 0, "", marker);
  return lines.join("\n");
}

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n");
}
