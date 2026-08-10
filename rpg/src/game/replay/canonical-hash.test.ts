import { describe, expect, it } from "vitest";
import { canonicalSha256 } from "./canonical-hash";

describe("canonicalSha256", () => {
  it("uses JCS independent of object key order", async () => {
    await expect(canonicalSha256({ b: 2, a: 1 })).resolves.toBe(
      await canonicalSha256({ a: 1, b: 2 }),
    );
  });
});
