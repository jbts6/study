import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { RunRequest, RunResult } from "../protocol/types";

export interface LocalPythonProcess {
  readonly pid?: number;
  readonly result: Promise<RunResult>;
  interrupt(): void;
  kill(): Promise<void>;
}

interface PythonRunProcessOptions {
  readonly pythonPath: string;
  readonly script: string;
  readonly request: RunRequest;
}

export class PythonRunProcess implements LocalPythonProcess {
  readonly pid?: number;
  readonly result: Promise<RunResult>;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly exited: Promise<void>;

  constructor(options: PythonRunProcessOptions) {
    this.child = spawn(options.pythonPath, ["-B", options.script], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.pid = this.child.pid;

    let markExited!: () => void;
    this.exited = new Promise<void>((resolve) => { markExited = resolve; });
    this.result = new Promise<RunResult>((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      this.child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      this.child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
      this.child.once("error", (error) => {
        markExited();
        reject(error);
      });
      this.child.once("close", (code, signal) => {
        markExited();
        const output = Buffer.concat(stdout).toString("utf8").trim();
        try {
          resolve(JSON.parse(output) as RunResult);
        } catch {
          const detail = Buffer.concat(stderr).toString("utf8").trim();
          reject(new Error(
            detail || `Python 进程退出，code=${code ?? "null"}, signal=${signal ?? "none"}`,
          ));
        }
      });
    });

    this.child.stdin.end(JSON.stringify(options.request));
  }

  interrupt(): void {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill("SIGINT");
    }
  }

  async kill(): Promise<void> {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill("SIGKILL");
    }
    await this.exited;
  }
}
