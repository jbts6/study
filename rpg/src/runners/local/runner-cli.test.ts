import { describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { WebSocket } from "ws";
import { loadPythonDetection } from "./test-support";

const python = await loadPythonDetection();
const repoRoot = path.resolve(process.cwd(), "..");
const npmCli = process.env.npm_execpath;

function spawnRunner(port: string): ChildProcess {
  if (!npmCli) throw new Error("npm_execpath is unavailable");
  return spawn(process.execPath, [npmCli, "--prefix", "rpg", "run", "runner", "--", "--port", port], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function waitForReady(proc: ChildProcess, timeoutMs = 8_000): Promise<{ port: number; pid: number }> {
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
          const message = JSON.parse(line) as { type?: unknown; port?: unknown; pid?: unknown };
          if (message.type === "runner_ready" && typeof message.port === "number" && typeof message.pid === "number") {
            clearTimeout(timer);
            resolve({ port: message.port, pid: message.pid });
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
    let runnerPid: number | undefined;
    try {
      const ready = await waitForReady(proc);
      const { port } = ready;
      runnerPid = ready.pid;
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
      process.kill(runnerPid, "SIGTERM");
      const code = await new Promise<number | null>((resolve) => {
        proc.on("exit", (c) => resolve(c));
      });
      // POSIX: graceful shutdown via the signal handler returns 0.
      // Windows: TerminateProcess kills the process with a null code; the
      // handler still runs in real Ctrl+C console scenarios.
      if (process.platform === "win32") {
        expect(code).not.toBeNull();
      } else {
        expect(code).toBe(0);
      }
    } finally {
      if (runnerPid !== undefined) {
        try { process.kill(runnerPid, "SIGKILL"); } catch { /* process already exited */ }
      }
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }
  }, 15_000);
});
