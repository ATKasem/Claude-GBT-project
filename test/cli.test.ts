import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli.ts";

test("cli init, turn, and status operate on a shared file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cgbt-cli-"));
  const sharedFile = join(directory, "shared.md");
  const output = createOutputCapture();

  try {
    assert.equal(await main(["init", "--file", sharedFile], output), 0);
    assert.match(await readFile(sharedFile, "utf8"), /ORCHESTRATOR_STATUS: continue/);

    assert.equal(
      await main(
        [
          "turn",
          "--file",
          sharedFile,
          "--agent",
          "Cody",
          "--status",
          "done",
          "--message",
          "Scaffold complete.",
        ],
        output,
      ),
      0,
    );

    const updatedMarkdown = await readFile(sharedFile, "utf8");
    assert.match(updatedMarkdown, /ORCHESTRATOR_STATUS: done/);
    assert.match(updatedMarkdown, /Scaffold complete\./);

    assert.equal(await main(["status", "--file", sharedFile], output), 0);
    assert.match(output.stdoutText, /Orchestrator Status: done/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function createOutputCapture(): {
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  stdoutText: string;
  stderrText: string;
} {
  const capture = {
    stdoutText: "",
    stderrText: "",
  };

  return {
    stdout: {
      write(chunk: string): void {
        capture.stdoutText += chunk;
      },
    },
    stderr: {
      write(chunk: string): void {
        capture.stderrText += chunk;
      },
    },
    get stdoutText(): string {
      return capture.stdoutText;
    },
    get stderrText(): string {
      return capture.stderrText;
    },
  };
}
