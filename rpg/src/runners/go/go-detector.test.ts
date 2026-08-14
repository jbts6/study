import { describe, expect, it } from "vitest";
import { detectGo } from "./go-detector";

describe("detectGo", () => {
  it("找不到 go 时提供安装恢复动作", async () => {
    const result = await detectGo({
      runVersion: async () => { throw new Error("ENOENT"); },
    });

    expect(result).toMatchObject({
      ok: false,
      code: "GO_NOT_FOUND",
      recoveryAction: expect.stringContaining("安装 Go"),
    });
  });

  it("返回可用的 Go 路径和版本", async () => {
    await expect(detectGo({
      goPath: "custom-go",
      runVersion: async () => "go version go1.24.3 windows/amd64",
    })).resolves.toEqual({ ok: true, goPath: "custom-go", version: "1.24.3" });
  });
});
