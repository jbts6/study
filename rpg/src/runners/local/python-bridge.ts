import { spawn, type ChildProcess } from "node:child_process";
import type { LocalRunnerChannel } from "./channel";
import type { RunRequest, RunResult } from "../protocol/types";

export interface PythonBridgeOptions {
  readonly pythonPath: string;
  readonly daemonScript: string;
  readonly startupTimeoutMs?: number;
}

const STDERR_LIMIT = 4096;
const DEFAULT_STARTUP_TIMEOUT_MS = 5_000;

export class PythonBridge implements LocalRunnerChannel {
  private process: ChildProcess | undefined;
  private readonly options: PythonBridgeOptions;
  private _generation = 0;
  private buffer = "";
  private stderrBuffer = "";
  private readyPromise: Promise<void> | undefined;
  private readyResolve: ((value: void) => void) | undefined;
  private readyReject: ((error: Error) => void) | undefined;
  private readySettled = false;
  private exitPromise: Promise<void> | undefined;
  private exitResolve: (() => void) | undefined;
  private exitSettled = false;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;
  private killed = false;

  public onMessage: ((result: RunResult) => void) | undefined;
  public onExit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;

  constructor(options: PythonBridgeOptions) {
    this.options = options;
  }

  get generation(): number {
    return this._generation;
  }

  get pid(): number | undefined {
    return this.process?.pid;
  }

  get stderr(): string {
    return this.stderrBuffer;
  }

  private ensureProcess(): ChildProcess {
    if (this.process) return this.process;
    const proc = spawn(this.options.pythonPath, [this.options.daemonScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process = proc;
    this.buffer = "";
    this.stderrBuffer = "";
    this.readySettled = false;
    this.exitSettled = false;
    this.killed = false;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.exitPromise = new Promise<void>((resolve) => {
      this.exitResolve = resolve;
    });
    this.startupTimer = setTimeout(() => {
      this.settleReady(new Error("Python daemon startup timeout"));
    }, this.options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS);
    proc.stdout?.setEncoding("utf-8");
    proc.stdout?.on("data", (data: string) => this.handleStdout(data));
    proc.stderr?.setEncoding("utf-8");
    proc.stderr?.on("data", (data: string) => this.handleStderr(data));
    proc.on("error", (err: Error) => {
      this.settleReady(err);
      this.settleExit();
    });
    proc.on("exit", (code, signal) => {
      this.process = undefined;
      this._generation++;
      if (!this.readySettled) {
        this.settleReady(new Error(`Python daemon exited before ready (code=${code}, signal=${signal})`));
      }
      this.settleExit();
      this.onExit?.(code, signal);
    });
    return proc;
  }

  private settleReady(error?: Error): void {
    if (this.readySettled) return;
    this.readySettled = true;
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = undefined;
    }
    if (error) {
      this.readyReject?.(error);
    } else {
      this.readyResolve?.();
    }
  }

  private settleExit(): void {
    if (this.exitSettled) return;
    this.exitSettled = true;
    this.exitResolve?.();
  }

  private handleStdout(data: string): void {
    this.buffer += data;
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { ready?: boolean } & RunResult;
        if (parsed.ready === true) {
          this.settleReady();
          continue;
        }
        this.onMessage?.(parsed as RunResult);
      } catch {
        /* ignore non-JSON lines */
      }
    }
  }

  private handleStderr(data: string): void {
    if (this.stderrBuffer.length < STDERR_LIMIT) {
      this.stderrBuffer = (this.stderrBuffer + data).slice(0, STDERR_LIMIT);
    }
  }

  waitReady(): Promise<void> {
    this.ensureProcess();
    return this.readyPromise!;
  }

  async send(request: RunRequest): Promise<void> {
    const proc = this.ensureProcess();
    const stdin = proc.stdin;
    if (!stdin) {
      throw new Error("Python daemon stdin unavailable");
    }
    await new Promise<void>((resolve, reject) => {
      stdin.write(JSON.stringify(request) + "\n", (err) => {
        if (err) reject(new Error(`Python stdin write failed: ${err.message}`));
        else resolve();
      });
    });
  }

  interrupt(): void {
    this.process?.kill("SIGINT");
  }

  async kill(): Promise<void> {
    if (!this.killed && this.process) {
      this.killed = true;
      try {
        this.process.kill("SIGKILL");
      } catch {
        /* process may have already exited */
      }
    }
    if (this.exitPromise) await this.exitPromise;
  }
}
