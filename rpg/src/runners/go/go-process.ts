import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { clearTimer } from "../shared/adapter";

export interface StartGoProcessOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdin?: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
}

export interface GoProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly truncated: boolean;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface GoProcessHandle {
  readonly result: Promise<GoProcessResult>;
  interrupt(): void;
  kill(): Promise<void>;
}

export type StartGoProcess = (options: StartGoProcessOptions) => GoProcessHandle;

export type ProcessTreeTermination =
  | Readonly<{ kind: "taskkill"; args: readonly string[] }>
  | Readonly<{ kind: "process-group"; pid: number; signal: NodeJS.Signals }>;

export function processTreeTermination(
  platform: NodeJS.Platform,
  pid: number,
  signal: NodeJS.Signals,
): ProcessTreeTermination {
  if (platform === "win32") {
    return {
      kind: "taskkill",
      args: ["/PID", String(pid), "/T", ...(signal === "SIGKILL" ? ["/F"] : [])],
    };
  }
  return { kind: "process-group", pid: -pid, signal };
}

function runTaskkill(args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("taskkill", [...args], { windowsHide: true }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

class LimitedOutput {
  private readonly chunks: Buffer[] = [];
  private bytes = 0;
  truncated = false;

  constructor(private readonly limit: number) {}

  append(chunk: Buffer): void {
    const remaining = this.limit - this.bytes;
    if (remaining <= 0) {
      this.truncated = true;
      return;
    }
    const accepted = chunk.subarray(0, remaining);
    this.chunks.push(accepted);
    this.bytes += accepted.byteLength;
    if (accepted.byteLength < chunk.byteLength) this.truncated = true;
  }

  text(): string {
    let buffer = Buffer.concat(this.chunks);
    let text = buffer.toString("utf8").trimEnd();
    while (Buffer.byteLength(text, "utf8") > this.limit && buffer.byteLength > 0) {
      buffer = buffer.subarray(0, -1);
      text = buffer.toString("utf8").trimEnd();
    }
    return text;
  }
}

export class GoProcess implements GoProcessHandle {
  readonly result: Promise<GoProcessResult>;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly exited: Promise<void>;

  constructor(options: StartGoProcessOptions) {
    const startedAt = Date.now();
    const stdout = new LimitedOutput(options.maxOutputBytes);
    const stderr = new LimitedOutput(options.maxOutputBytes);
    let timedOut = false;
    this.child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });

    let markExited!: () => void;
    this.exited = new Promise<void>((resolve) => { markExited = resolve; });
    this.result = new Promise<GoProcessResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        void this.terminateTree("SIGKILL").catch(() => {
          if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill("SIGKILL");
        });
      }, options.timeoutMs);
      this.child.stdout.on("data", (chunk: Buffer) => stdout.append(chunk));
      this.child.stderr.on("data", (chunk: Buffer) => stderr.append(chunk));
      this.child.once("error", (error) => {
        clearTimer(timer);
        markExited();
        reject(error);
      });
      this.child.once("close", (exitCode, signal) => {
        clearTimer(timer);
        markExited();
        resolve({
          exitCode,
          signal,
          stdout: stdout.text(),
          stderr: stderr.text(),
          truncated: stdout.truncated || stderr.truncated,
          timedOut,
          durationMs: Date.now() - startedAt,
        });
      });
    });
    this.child.stdin.end(options.stdin);
  }

  interrupt(): void {
    void this.terminateTree("SIGINT").catch(() => {
      if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill("SIGINT");
    });
  }

  async kill(): Promise<void> {
    await this.terminateTree("SIGKILL");
    await this.exited;
  }

  private async terminateTree(signal: NodeJS.Signals): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    const pid = this.child.pid;
    if (pid === undefined) {
      if (!this.child.kill(signal)) throw new Error("Go 进程没有可终止的 PID。");
      return;
    }
    const plan = processTreeTermination(process.platform, pid, signal);
    try {
      if (plan.kind === "taskkill") await runTaskkill(plan.args);
      else process.kill(plan.pid, plan.signal);
    } catch (error) {
      if (isNoSuchProcess(error)) return;
      if (this.child.exitCode !== null || this.child.signalCode !== null) return;
      if (!this.child.kill(signal)) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }
}

function isNoSuchProcess(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH";
}

export const startGoProcess: StartGoProcess = (options) => new GoProcess(options);
