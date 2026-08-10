import { describe, expect, it } from "vitest";
import { canonicalSha256 } from "./canonical-hash";

describe("canonicalSha256", () => {
  it("uses JCS key order and a fixed SHA-256 vector", async () => {
    const hash = await canonicalSha256({ b: 2, a: 1 });

    expect(hash).toBe("sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777");
    expect(hash).toBe(await canonicalSha256({ a: 1, b: 2 }));
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("hashes non-ASCII strings and array values canonically", async () => {
    const value = { label: "café", values: ["雪", 1, true] };

    await expect(canonicalSha256(value)).resolves.toMatch(/^sha256:[0-9a-f]{64}$/);
    await expect(canonicalSha256(value)).resolves.not.toBe(
      await canonicalSha256({ label: "café", values: ["雪", true, 1] }),
    );
  });

  it("rejects non-canonical values", async () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    await expect(canonicalSha256(undefined)).rejects.toThrow(TypeError);
    await expect(canonicalSha256({ value: undefined })).rejects.toThrow(TypeError);
    await expect(canonicalSha256([undefined])).rejects.toThrow(TypeError);
    await expect(canonicalSha256(Number.NaN)).rejects.toThrow(TypeError);
    await expect(canonicalSha256(Number.POSITIVE_INFINITY)).rejects.toThrow(TypeError);
    await expect(canonicalSha256(circular)).rejects.toThrow(TypeError);
  });
});
