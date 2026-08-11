import { describe, expect, it } from "vitest";
import { detectPython } from "./python-detector";

describe("python detector", () => {
  it("finds a python interpreter at version 3.12 or higher", async () => {
    const result = await detectPython();
    if (result.ok) {
      expect(result.path).toMatch(/python/);
      const [major, minor] = result.version.split(".").map(Number);
      expect(major).toBeGreaterThanOrEqual(3);
      if (major === 3) expect(minor).toBeGreaterThanOrEqual(12);
    } else {
      expect(result.code).toMatch(/^PYTHON_NOT_FOUND$|^PYTHON_VERSION_TOO_LOW$/);
    }
  });
});
