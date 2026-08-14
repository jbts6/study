import type { LocalPythonProcess } from "../runners/local/python-process";
import { PythonRunnerAdapter } from "../runners/local/adapter";
import type { RunRequest, RunResult, RunnerState } from "../runners/protocol/types";
import type { PythonDetection } from "../runners/local/python-detector";
import type { RunnerClient, RunnerDisplayState } from "../app/runner-client";

type DirectRunnerDependencies = Readonly<{
  detect(): Promise<PythonDetection>;
  createProcess(request: RunRequest, pythonPath: string): LocalPythonProcess;
}>;

function displayState(state: RunnerState): RunnerDisplayState {
  if (state === "ready") return "ready";
  if (state === "running" || state === "interrupting") return "running";
  if (state === "unavailable") return "unavailable";
  return "connecting";
}

export class DirectRunnerClient implements RunnerClient {
  private _state: RunnerDisplayState = "connecting";
  private pythonPath?: string;
  private adapter?: PythonRunnerAdapter;
  private activeProcess?: LocalPythonProcess;
  private readonly listeners = new Set<(state: RunnerDisplayState) => void>();

  constructor(private readonly dependencies: DirectRunnerDependencies) {}

  get state(): RunnerDisplayState {
    return this._state;
  }

  async connect(): Promise<void> {
    const detection = await this.dependencies.detect();
    if (!detection.ok) {
      this.setState("unavailable");
      throw new Error(detection.message);
    }
    this.pythonPath = detection.path;
    this.adapter = new PythonRunnerAdapter({
      startProcess: (request) => {
        const process = this.dependencies.createProcess(request, detection.path);
        this.activeProcess = process;
        return process;
      },
    });
    this.adapter.onStateChange((state) => this.setState(displayState(state)));
    this.setState("ready");
  }

  async run(request: RunRequest): Promise<RunResult> {
    const adapter = this.adapter;
    if (!adapter || this.pythonPath === undefined) throw new Error("本地 Python Runner 尚未连接。");
    try {
      const result = await adapter.run(request);
      return projectSourceFile(result, request);
    } finally {
      const process = this.activeProcess;
      this.activeProcess = undefined;
      if (process !== undefined) await process.kill();
    }
  }

  async interrupt(runId: string): Promise<void> {
    await this.adapter?.interrupt(runId);
  }

  onStateChange(listener: (state: RunnerDisplayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    void this.adapter?.dispose();
    this.pythonPath = undefined;
    this.activeProcess = undefined;
    this.setState("unavailable");
  }

  private setState(state: RunnerDisplayState): void {
    if (state === this._state) return;
    this._state = state;
    for (const listener of this.listeners) listener(state);
  }
}

function projectSourceFile(result: RunResult, request: RunRequest): RunResult {
  if (request.language !== "python") return result;
  const sourceFile = `${request.questId}.py`;
  return {
    ...result,
    diagnostics: result.diagnostics.map((value) => value.location?.file !== "main.py"
      ? value
      : { ...value, location: { ...value.location, file: sourceFile } }),
  };
}
