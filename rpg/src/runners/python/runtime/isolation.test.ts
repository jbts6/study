import { describe, expect, it } from "vitest";
import {
  loadPythonDetection,
  sendAndWait,
  withPythonBridge,
} from "../../local/test-support";
import type { RunRequest } from "../../protocol/types";
import { worldViewFixture } from "../../../game/testing/fixture";

const python = await loadPythonDetection();

function makeRequest(runId: string, helperValue: string): RunRequest {
  return {
    protocolVersion: 1 as const,
    runId,
    attemptId: "iso-a1",
    questId: "q",
    language: "python",
    files: {
      "main.py": `def choose_turn(world):\n    import helper\n    return {'action': {'type': 'wait'}, 'value': helper.VALUE}\n`,
      "helper.py": `VALUE = "${helperValue}"\n`,
    },
    entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: worldViewFixture,
    allowedModules: [],
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

describe.skipIf(!python)("resident process isolation (CPython 3.12+)", () => {
  it("does not leak sys.modules between runs with same-named helper", async () => {
    await withPythonBridge(async (bridge) => {
      const first = await sendAndWait(bridge, makeRequest("iso-1", "first"));
      expect(first.executionStatus).toBe("completed");
      expect((first.returnValue as Record<string, unknown>)?.value).toBe("first");

      const second = await sendAndWait(bridge, makeRequest("iso-2", "second"));
      expect(second.executionStatus).toBe("completed");
      expect((second.returnValue as Record<string, unknown>)?.value).toBe("second");
    });
  });
});
