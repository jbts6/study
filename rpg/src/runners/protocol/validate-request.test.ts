import { describe, expect, it } from "vitest";
import { worldViewFixture } from "../../game/testing/fixture";
import { validateRunRequest } from "./validate-request";

const limits = {
  timeoutMs: 2_000,
  interruptGraceMs: 250,
  maxFiles: 2,
  maxFileBytes: 1_024,
  maxSourceBytes: 2_048,
  maxOutputBytes: 4_096,
  maxTraceEvents: 1_000,
  maxValueDepth: 3,
};

function validRequest(): Record<string, unknown> {
  return {
    protocolVersion: 1,
    runId: "run-01",
    attemptId: "attempt-01",
    questId: "python-marsh-01",
    language: "python",
    files: { "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n" },
    entrypoint: { file: "main.py", callable: "choose_turn" },
    worldView: worldViewFixture,
    allowedModules: ["math"],
    limits: { ...limits },
  };
}

function diagnosticCode(input: unknown): string | undefined {
  const result = validateRunRequest(input);
  return result.ok ? undefined : result.diagnostics[0]?.code;
}

describe("validateRunRequest", () => {
  it("accepts the parsed JSON object without cloning or freezing it", () => {
    const request = { ...validRequest(), extra: true };
    const result = validateRunRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(request);
      expect(Object.isFrozen(result.value)).toBe(false);
    }
  });

  it("requires a supported object request with non-empty identifiers", () => {
    expect(diagnosticCode(null)).toBe("INVALID_REQUEST");
    expect(diagnosticCode([])).toBe("INVALID_REQUEST");
    expect(diagnosticCode({ ...validRequest(), protocolVersion: 2 })).toBe("UNSUPPORTED_PROTOCOL_VERSION");
    expect(diagnosticCode({ ...validRequest(), runId: " " })).toBe("INVALID_IDENTIFIER");
    expect(diagnosticCode({ ...validRequest(), language: "javascript" })).toBe("UNSUPPORTED_LANGUAGE");
  });

  it("accepts Python callable and allowedModules requests", () => {
    const result = validateRunRequest({
      ...validRequest(),
      language: "python",
      entrypoint: { file: "main.py", callable: "choose_turn" },
      allowedModules: ["math"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects Go requests carrying a Python module allowlist", () => {
    const result = validateRunRequest({
      ...validRequest(),
      language: "go",
      files: { "strategy.go": "package main" },
      entrypoint: { file: "strategy.go" },
      allowedModules: ["math"],
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_GO_REQUEST" }] });
  });

  it("checks source containers, local paths and byte budgets", () => {
    expect(diagnosticCode({ ...validRequest(), files: {} })).toBe("INVALID_FILES");
    expect(diagnosticCode({ ...validRequest(), files: { "../main.py": "pass" } })).toBe("INVALID_FILE_PATH");
    expect(diagnosticCode({ ...validRequest(), files: { "main.py": "x".repeat(1_025) } })).toBe("FILE_LIMIT_EXCEEDED");
    expect(diagnosticCode({
      ...validRequest(),
      files: { "main.py": "x".repeat(1_024), "helper.py": "x".repeat(1_024), "third.py": "pass" },
    })).toBe("FILE_LIMIT_EXCEEDED");
  });

  it("requires an existing Python entrypoint", () => {
    expect(diagnosticCode({ ...validRequest(), entrypoint: null })).toBe("INVALID_ENTRYPOINT");
    expect(diagnosticCode({ ...validRequest(), entrypoint: { file: "missing.py", callable: "choose_turn" } })).toBe("ENTRYPOINT_FILE_MISSING");
    expect(diagnosticCode({ ...validRequest(), entrypoint: { file: "main.py", callable: "choose.turn" } })).toBe("INVALID_IDENTIFIER");
  });

  it("keeps the small accidental-import whitelist", () => {
    expect(diagnosticCode({ ...validRequest(), allowedModules: "math" })).toBe("INVALID_ALLOWED_MODULE");
    expect(diagnosticCode({ ...validRequest(), allowedModules: ["socket"] })).toBe("UNSUPPORTED_ALLOWED_MODULE");
    expect(diagnosticCode({ ...validRequest(), allowedModules: ["math.extra"] })).toBe("INVALID_ALLOWED_MODULE");
  });

  it("requires positive execution limits", () => {
    expect(diagnosticCode({ ...validRequest(), limits: { ...limits, timeoutMs: 0 } })).toBe("INVALID_LIMIT");
    expect(diagnosticCode({ ...validRequest(), limits: { timeoutMs: 100 } })).toBe("INVALID_LIMIT");
  });

  it("requires a WorldView object", () => {
    expect(diagnosticCode({ ...validRequest(), worldView: null })).toBe("INVALID_WORLD_VIEW");
    expect(diagnosticCode({ ...validRequest(), worldView: [] })).toBe("INVALID_WORLD_VIEW");
  });
});
