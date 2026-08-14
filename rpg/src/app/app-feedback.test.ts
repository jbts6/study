import { describe, expect, it } from "vitest";
import type { RunResult } from "../runners/protocol/types";
import { feedbackFromRunResult } from "./app-feedback";

function compileErrorResult(): RunResult {
  return {
    protocolVersion: 1,
    runId: "go-run",
    attemptId: "go-run:1",
    executionStatus: "compile_error",
    trace: [],
    diagnostics: [{
      code: "GO_COMPILE_ERROR",
      severity: "error",
      message: "syntax error",
      location: { file: "go-marsh-01.go", line: 2, column: 7 },
      recoveryAction: "修改 Go 代码后重新运行。",
    }],
    streams: { stdout: "", stderr: "", truncated: false },
    metrics: { durationMs: 1, traceEvents: 0 },
  };
}

describe("feedbackFromRunResult", () => {
  it("labels Go compile errors with the Go language", () => {
    const feedback = feedbackFromRunResult(compileErrorResult(), "go");

    expect(feedback.title).toBe("Go 编译失败");
    expect(feedback.messages).toContain("[error] GO_COMPILE_ERROR go-marsh-01.go:2:7 syntax error");
  });
});
