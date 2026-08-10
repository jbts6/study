import type { RunRequest, RunResult } from "../protocol/types";

export interface PythonWorkerApi {
  initialize(): Promise<{ state: "ready" | "unavailable"; runtimeVersion?: string }>;
  run(request: RunRequest): Promise<RunResult>;
  interrupt(runId: string): Promise<void>;
}

export type PythonWorkerFactory = () => Worker;

export interface PythonWorkerClient {
  readonly workerProxy: PythonWorkerApi;
  call<TResult>(method: (...args: any[]) => Promise<TResult>, ...args: any[]): Promise<TResult>;
  interrupt(): Promise<void>;
  terminate(): void;
}

export interface PythonWorkerClientFactory {
  create(workerFactory: PythonWorkerFactory): PythonWorkerClient;
}
