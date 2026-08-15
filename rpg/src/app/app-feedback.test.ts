import { describe, expect, it } from "vitest";
import type { RunResult } from "../runners/protocol/types";
import { combatErrorFeedback, feedbackFromRunResult, type AppFeedback } from "./app-feedback";

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
  it("exposes a required feedback layer", () => {
    const feedback = feedbackFromRunResult(compileErrorResult(), "go");
    const layer: NonNullable<AppFeedback["layer"]> = feedback.layer;

    expect(layer).toBe("program");
  });

  it("labels Go compile errors with the Go language", () => {
    const feedback = feedbackFromRunResult(compileErrorResult(), "go");

    expect(feedback.layer).toBe("program");
    expect(feedback.title).toBe("Go 编译失败");
    expect(feedback.messages).toContain("[error] GO_COMPILE_ERROR go-marsh-01.go:2:7 syntax error");
    expect(feedback.relatedReferenceIds).toBeUndefined();
  });
});

describe("combatErrorFeedback", () => {
  it("maps invalid commands to the turn command reference", () => {
    const feedback = combatErrorFeedback([{ code: "INVALID_COMMAND", path: "$.action", message: "x" }]);
    expect(feedback.layer).toBe("task");
    expect(feedback.relatedReferenceIds).toEqual(["type.turn-command"]);
  });

  it("maps invalid movement paths to cell and movement action references", () => {
    expect(combatErrorFeedback([{ code: "INVALID_MOVE_PATH", path: "$.movePath", message: "x" }]).relatedReferenceIds)
      .toEqual(["type.cell", "action.move-and-attack", "action.move-and-cast", "action.move-and-interact"]);
  });

  it("maps unavailable skills to skill and casting references", () => {
    expect(combatErrorFeedback([{ code: "SKILL_ON_COOLDOWN", path: "$.action.skillId", message: "x" }]).relatedReferenceIds)
      .toEqual(["type.skill", "action.cast", "action.move-and-cast"]);
  });

  it("maps invalid interactions to objective and interaction references", () => {
    expect(combatErrorFeedback([{ code: "INTERACTION_INVALID", path: "$.action.targetId", message: "x" }]).relatedReferenceIds)
      .toEqual(["type.objective", "action.interact", "action.move-and-interact"]);
  });
});
