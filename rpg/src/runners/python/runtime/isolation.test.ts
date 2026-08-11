import { describe, expect, it } from "vitest";
import { PythonRunnerAdapter } from "../../local/adapter";
import { PythonRunProcess } from "../../local/python-process";
import { loadPythonDetection, runOnceScript } from "../../local/test-support";
import type { RunRequest } from "../../protocol/types";
import { worldViewFixture } from "../../../game/testing/fixture";

const python = await loadPythonDetection();

function makeRequest(runId: string, source: string): RunRequest {
  return {
    protocolVersion: 1,
    runId,
    attemptId: "attempt-1",
    questId: "python-marsh-01",
    language: "python",
    files: { "main.py": source },
    entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: worldViewFixture,
    allowedModules: ["math"],
    limits: {
      timeoutMs: 5_000,
      interruptGraceMs: 500,
      maxFiles: 10,
      maxFileBytes: 65_536,
      maxSourceBytes: 65_536,
      maxOutputBytes: 16_384,
      maxTraceEvents: 1_000,
      maxValueDepth: 3,
    },
  };
}

describe.skipIf(!python)("one process per Python run", () => {
  it("interrupts one run and starts the next run in a fresh process", async () => {
    if (!python) throw new Error("CPython 3.12+ is required");
    const processes: PythonRunProcess[] = [];
    const adapter = new PythonRunnerAdapter({
      startProcess: (request) => {
        const process = new PythonRunProcess({
          pythonPath: python.path,
          script: runOnceScript,
          request,
        });
        processes.push(process);
        return process;
      },
    });

    const looping = makeRequest("looping", "def choose_turn(world):\n    while True:\n        pass\n");
    const interrupted = adapter.run(looping);
    await adapter.interrupt(looping.runId);
    await expect(interrupted).resolves.toMatchObject({ executionStatus: "interrupted" });

    const next = makeRequest(
      "next",
      "def choose_turn(world):\n    return {'actorId': world['activeUnitId'], 'expectedRevision': world['revision'], 'action': {'type': 'wait'}}\n",
    );
    await expect(adapter.run(next)).resolves.toMatchObject({ executionStatus: "completed" });
    expect(processes).toHaveLength(2);
    await adapter.dispose();
  }, 10_000);
});
