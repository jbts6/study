import { spawn, type ChildProcess } from "node:child_process";
import type { LocalRunnerChannel } from "./channel";
import type { RunRequest, RunResult } from "../protocol/types";

export interface PythonBridgeOptions {
  readonly pythonPath: string;
  readonly daemonScript: string;
  readonly startupTimeoutMs?: number;
}

export class PythonBridge implements LocalRunnerChannel {
  private process: ChildProcess | undefined;
  private readonly options: PythonBridgeOptions;
  private _generation = 0;
  private buffer = "";
  private readyPromise: Promise<void> | undefined;
  private readyResolve: ((value: void) => void) | undefined;

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

  private ensureProcess(): ChildProcess {
    if (this.process) return this.process;
    const proc = spawn(this.options.pythonPath, [this.options.daemonScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process = proc;
    this.buffer = "";
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });
    proc.stdout?.setEncoding("utf-8");
    proc.stdout?.on("data", (data: string) => this.handleStdout(data));
    proc.stderr?.setEncoding("utf-8");
    proc.stderr?.on("data", () => {
      /* discard stderr */
    });
    proc.on("exit", (code, signal) => {
      this.process = undefined;
      this._generation++;
      this.onExit?.(code, signal);
    });
    return proc;
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
          this.readyResolve?.();
          continue;
        }
        this.onMessage?.(parsed as RunResult);
      } catch {
        /* ignore non-JSON lines */
      }
    }
  }

  async waitReady(): Promise<void> {
    const timeoutMs = this.options.startupTimeoutMs ?? 5000;
    this.ensureProcess();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Python daemon startup timeout")), timeoutMs),
    );
    await Promise.race([this.readyPromise!, timeout]);
  }

  send(request: RunRequest): boolean {
    const proc = this.ensureProcess();
    if (!proc.stdin) return false;
    proc.stdin.write(JSON.stringify(request) + "\n");
    return true;
  }

  interrupt(): void {
    this.process?.kill("SIGINT");
  }

  kill(): void {
    this.process?.kill("SIGKILL");
  }
}
