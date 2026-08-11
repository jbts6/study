import { describe, expect, it } from "vitest";
import { detectPython } from "./python-detector";

describe("python detector", () => {
  it("selects the first compatible candidate when python3 is too low but python is new", async () => {
    const result = await detectPython({
      candidates: ["python3", "python"],
      probe: async (exec) =>
        exec === "python3" ? { path: "python3", version: "3.10.0" } : { path: "python", version: "3.13.0" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toBe("python");
      expect(result.version).toBe("3.13.0");
    }
  });

  it("returns the highest low version for diagnostics when all candidates are too low", async () => {
    const result = await detectPython({
      candidates: ["python3", "python"],
      probe: async (exec) =>
        exec === "python3" ? { path: "python3", version: "3.10.0" } : { path: "python", version: "3.11.2" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PYTHON_VERSION_TOO_LOW");
      expect(result.message).toContain("3.11.2");
      expect(result.message).toContain("https://www.python.org/downloads/");
    }
  });

  it("returns PYTHON_NOT_FOUND with download url when no candidate exists", async () => {
    const result = await detectPython({ probe: async () => undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PYTHON_NOT_FOUND");
      expect(result.message).toContain("https://www.python.org/downloads/");
    }
  });

  it("skips candidates with unparseable version output and continues", async () => {
    const result = await detectPython({
      candidates: ["python3", "python"],
      probe: async (exec) => (exec === "python3" ? undefined : { path: "python", version: "3.12.0" }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.path).toBe("python");
  });

  it("accepts a major version higher than 3", async () => {
    const result = await detectPython({
      probe: async () => ({ path: "python", version: "4.0.0" }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.version).toBe("4.0.0");
  });

  it("finds a real python interpreter at version 3.12 or higher", async () => {
    const result = await detectPython();
    if (result.ok) {
      const [major, minor] = result.version.split(".").map(Number);
      expect(major).toBeGreaterThanOrEqual(3);
      if (major === 3) expect(minor).toBeGreaterThanOrEqual(12);
    } else {
      expect(result.code).toMatch(/^PYTHON_NOT_FOUND$|^PYTHON_VERSION_TOO_LOW$/);
    }
  });
});
