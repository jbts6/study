import { describe, expect, it } from "vitest";
import { createGoBuildCacheKey } from "./go-project";

describe("createGoBuildCacheKey", () => {
  it("相同输入保持稳定，SDK 版本变化使旧缓存失效", () => {
    const current = createGoBuildCacheKey("package main", "2", "go1.25.1", "win32", "x64");

    expect(createGoBuildCacheKey("package main", "2", "go1.25.1", "win32", "x64")).toBe(current);
    expect(createGoBuildCacheKey("package main", "1", "go1.25.1", "win32", "x64")).not.toBe(current);
  });
});
