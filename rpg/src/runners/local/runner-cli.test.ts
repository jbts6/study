import { describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { WebSocket } from "ws";
import { loadPythonDetection } from "./test-support";

const python = await loadPythonDetection();

function spawnRunner(port: string): ChildProcess {
  return spawn(process.execPath, ["--experimental-strip-types", "src/runners/local/runner-cli.ts", "--port", port], {
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function waitForReady(proc: ChildProcess, timeoutMs = 8_000): Promise<number> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("timeout waiting for runner_ready")), timeoutMs);
    proc.stdout?.setEncoding("utf-8");
    proc.stdout?.on("data", (data: string) => {
      buffer += data;
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.includes("runner_ready")) {
          const match = line.match(/"port"\s*:\s*(\d+)/);
          if (match) {
            clearTimeout(timer);
            resolve(Number(match[1]));
          }
        }
      }
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`process exited before ready (code=${code})`));
    });
  });
}

describe("runner cli invalid port", () => {
  it("exits non-zero for an out-of-range port", async () => {
    const proc = spawnRunner("99999");
    try {
      const code = await new Promise<number>((resolve) => {
        proc.on("exit", (c) => resolve(c ?? -1));
      });
      expect(code).not.toBe(0);
    } finally {
      if (!proc.killed) proc.kill("SIGKILL");
    }
  }, 10_000);
});

describe.skipIf(!python)("runner cli (CPython 3.12+)", () => {
  it("starts, accepts a websocket connection, and shuts down on signal", async () => {
    const proc = spawnRunner("0");
    try {
      const port = await waitForReady(proc);
      expect(port).toBeGreaterThan(0);
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("ws open timeout")), 5_000);
        ws.on("open", () => { clearTimeout(timer); resolve(); });
      });
      const message = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("ws message timeout")), 5_000);
        ws.on("message", (data) => {
          clearTimeout(timer);
          resolve(data.toString());
        });
        ws.send(JSON.stringify({ type: "subscribe_state" }));
      });
      expect(message).toContain("state");
      ws.close();
      proc.kill("SIGTERM");
      const code = await new Promise<number | null>((resolve) => {
        proc.on("exit", (c) => resolve(c));
      });
      // POSIX: graceful shutdown via the signal handler returns 0.
      // Windows: TerminateProcess kills the process with a null code; the
      // handler still runs in real Ctrl+C console scenarios.
      expect(code === 0 || code === null).toBe(true);
    } finally {
      if (!proc.killed) proc.kill("SIGKILL");
    }
  }, 15_000);
});
