import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
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
      windowsHide: true,
    });

    let markExited!: () => void;
    this.exited = new Promise<void>((resolve) => { markExited = resolve; });
    this.result = new Promise<GoProcessResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        this.child.kill("SIGKILL");
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
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill("SIGINT");
  }

  async kill(): Promise<void> {
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill("SIGKILL");
    await this.exited;
  }
}

export const startGoProcess: StartGoProcess = (options) => new GoProcess(options);
