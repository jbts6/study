import { describe, expect, it } from "vitest";
import { processTreeTermination } from "./go-process";

describe("processTreeTermination", () => {
  it("在 Windows 终止整个进程树", () => {
    expect(processTreeTermination("win32", 42, "SIGINT")).toEqual({
      kind: "taskkill",
      args: ["/PID", "42", "/T"],
    });
    expect(processTreeTermination("win32", 42, "SIGKILL")).toEqual({
      kind: "taskkill",
      args: ["/PID", "42", "/T", "/F"],
    });
  });

  it("在 POSIX 向独立进程组发送信号", () => {
    expect(processTreeTermination("linux", 42, "SIGINT")).toEqual({
      kind: "process-group",
      pid: -42,
      signal: "SIGINT",
    });
    expect(processTreeTermination("darwin", 42, "SIGKILL")).toEqual({
      kind: "process-group",
      pid: -42,
      signal: "SIGKILL",
    });
  });
});
