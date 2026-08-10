import { describe, expect, it } from "vitest";
import { worldViewFixture } from "../../game/testing/fixture";
import { validateRunRequest } from "./validate-request";

const limits = {
  timeoutMs: 2_000,
  interruptGraceMs: 250,
  maxFiles: 8,
  maxFileBytes: 16_384,
  maxSourceBytes: 65_536,
  maxOutputBytes: 16_384,
  maxTraceEvents: 1_000,
  maxValueDepth: 3,
};

function validRequest(): Record<string, unknown> {
  return {
    protocolVersion: 1,
    runId: "run-01J8K3",
    attemptId: "python-marsh-03-attempt-2",
    questId: "python-marsh-03",
    language: "python",
    files: {
      "main.py": "def choose_turn(world):\n    return {'action': {'type': 'wait'}}\n",
      "rules/helper.py": "VALUE = 41\n",
    },
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
  it("uses the projected shared WorldView fixture without the legacy map field", () => {
    expect(worldViewFixture).toMatchObject({
      battleId: "core-fixture",
      contentVersion: "python-slice-1",
      revision: 0,
      round: 1,
      activeUnitId: "scout",
      board: { width: 3, height: 2 },
      units: expect.any(Array),
      objectives: expect.any(Array),
    });
    expect("map" in worldViewFixture).toBe(false);
  });

  it("accepts a versioned multi-file Python request", () => {
    const result = validateRunRequest(validRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.protocolVersion).toBe(1);
      expect(result.value.language).toBe("python");
      expect(Object.keys(result.value.files)).toEqual(["main.py", "rules/helper.py"]);
    }
  });

  it("rejects a non-object, array, or non-plain top-level value", () => {
    expect(diagnosticCode(null)).toBe("INVALID_REQUEST");
    expect(diagnosticCode([])).toBe("INVALID_REQUEST");
    expect(diagnosticCode(new Date())).toBe("INVALID_REQUEST");
  });

  it("rejects an unsupported protocol version before other fields", () => {
    expect(diagnosticCode({ ...validRequest(), protocolVersion: 2 })).toBe("UNSUPPORTED_PROTOCOL_VERSION");
  });

  it("rejects unknown top-level fields with a stable diagnostic", () => {
    expect(diagnosticCode({ ...validRequest(), extra: true })).toBe("UNKNOWN_REQUEST_FIELD");
  });

  it("requires non-empty identifiers and Python language", () => {
    expect(diagnosticCode({ ...validRequest(), runId: "" })).toBe("INVALID_IDENTIFIER");
    expect(diagnosticCode({ ...validRequest(), attemptId: "  " })).toBe("INVALID_IDENTIFIER");
    expect(diagnosticCode({ ...validRequest(), questId: 42 })).toBe("INVALID_IDENTIFIER");
    expect(diagnosticCode({ ...validRequest(), language: "javascript" })).toBe("UNSUPPORTED_LANGUAGE");
  });

  it("rejects invalid file containers and file values", () => {
    expect(diagnosticCode({ ...validRequest(), files: {} })).toBe("INVALID_FILES");
    expect(diagnosticCode({ ...validRequest(), files: [] })).toBe("INVALID_FILES");
    expect(diagnosticCode({ ...validRequest(), files: { "main.py": 1 } })).toBe("INVALID_FILES");
  });

  it.each([
    "../main.py",
    "/main.py",
    "C:/main.py",
    "dir\\main.py",
    "dir//main.py",
    "./main.py",
    "dir/../main.py",
    "__pycache__/main.py",
    "dir/__pycache__/main.py",
    "dir/main.py\u0000",
  ])("rejects unsafe file path %s", (file) => {
    expect(diagnosticCode({ ...validRequest(), files: { [file]: "pass" } })).toBe("INVALID_FILE_PATH");
  });

  it("rejects too many files and UTF-8 byte budgets", () => {
    const manyFiles = Object.fromEntries([
      ["main.py", "pass"],
      ...Array.from({ length: 8 }, (_, index) => [`${index}.py`, "pass"] as const),
    ]);
    expect(diagnosticCode({ ...validRequest(), files: manyFiles })).toBe("FILE_LIMIT_EXCEEDED");
    expect(diagnosticCode({ ...validRequest(), files: { "main.py": "汉" }, limits: { ...limits, maxFileBytes: 2 } })).toBe("FILE_LIMIT_EXCEEDED");
    expect(diagnosticCode({ ...validRequest(), files: { "main.py": "🙂" }, limits: { ...limits, maxSourceBytes: 3 } })).toBe("SOURCE_LIMIT_EXCEEDED");
  });

  it("requires an existing entrypoint with a Python identifier callable", () => {
    expect(diagnosticCode({ ...validRequest(), entrypoint: { file: "missing.py", callable: "choose_turn" } })).toBe("ENTRYPOINT_FILE_MISSING");
    expect(diagnosticCode({ ...validRequest(), entrypoint: { file: "main.py", callable: "choose-turn" } })).toBe("INVALID_IDENTIFIER");
    expect(diagnosticCode({ ...validRequest(), entrypoint: null })).toBe("INVALID_ENTRYPOINT");
  });

  it("validates allowed modules as unique bare Python identifiers", () => {
    expect(diagnosticCode({ ...validRequest(), allowedModules: ["math", "math"] })).toBe("DUPLICATE_ALLOWED_MODULE");
    expect(diagnosticCode({ ...validRequest(), allowedModules: ["os.path"] })).toBe("INVALID_ALLOWED_MODULE");
    expect(diagnosticCode({ ...validRequest(), allowedModules: ["not-valid"] })).toBe("INVALID_ALLOWED_MODULE");
    expect(diagnosticCode({ ...validRequest(), allowedModules: [1] })).toBe("INVALID_ALLOWED_MODULE");
  });

  it("requires exactly eight positive safe integer limits", () => {
    expect(diagnosticCode({ ...validRequest(), limits: { ...limits, timeoutMs: 0 } })).toBe("INVALID_LIMIT");
    expect(diagnosticCode({ ...validRequest(), limits: { ...limits, timeoutMs: 1.5 } })).toBe("INVALID_LIMIT");
    expect(diagnosticCode({ ...validRequest(), limits: { ...limits, timeoutMs: Number.MAX_SAFE_INTEGER + 1 } })).toBe("INVALID_LIMIT");
    expect(diagnosticCode({ ...validRequest(), limits: { ...limits, extra: 1 } })).toBe("INVALID_LIMIT");
    expect(diagnosticCode({ ...validRequest(), limits: { ...limits, maxValueDepth: undefined } })).toBe("INVALID_LIMIT");
    expect(diagnosticCode({ ...validRequest(), limits: null })).toBe("INVALID_LIMIT");
  });

  it("requires worldView to be a non-array object", () => {
    expect(diagnosticCode({ ...validRequest(), worldView: null })).toBe("INVALID_WORLD_VIEW");
    expect(diagnosticCode({ ...validRequest(), worldView: [] })).toBe("INVALID_WORLD_VIEW");
  });

  it("returns a recursively frozen snapshot detached from every caller-owned value", () => {
    const request = validRequest();
    request.worldView = structuredClone(worldViewFixture);
    const result = validateRunRequest(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const snapshot = result.value;
    expect(snapshot).not.toBe(request);
    expect(snapshot.files).not.toBe(request.files);
    expect(snapshot.entrypoint).not.toBe(request.entrypoint);
    expect(snapshot.allowedModules).not.toBe(request.allowedModules);
    expect(snapshot.limits).not.toBe(request.limits);
    expect(snapshot.worldView).not.toBe(request.worldView);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.files)).toBe(true);
    expect(Object.isFrozen(snapshot.entrypoint)).toBe(true);
    expect(Object.isFrozen(snapshot.allowedModules)).toBe(true);
    expect(Object.isFrozen(snapshot.limits)).toBe(true);
    expect(Object.isFrozen(snapshot.worldView)).toBe(true);
    expect(Object.isFrozen(snapshot.worldView.board)).toBe(true);
    expect(Object.isFrozen(snapshot.worldView.board.blockedCells)).toBe(true);

    const sourceFiles = request.files as Record<string, string>;
    sourceFiles["main.py"] = "changed";
    (request.limits as Record<string, number>).timeoutMs = 1;
    (request.worldView as { revision: number }).revision = 99;
    expect(snapshot.files["main.py"]).toContain("choose_turn");
    expect(snapshot.limits.timeoutMs).toBe(2_000);
    expect(snapshot.worldView.revision).toBe(0);

    expect(() => {
      (snapshot.limits as { timeoutMs: number }).timeoutMs = 1;
    }).toThrow(TypeError);
  });
});
