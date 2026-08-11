import type { RunRequest, RunResult } from "../protocol/types";

export interface LocalRunnerChannel {
  readonly generation: number;
  onMessage: ((result: RunResult) => void) | undefined;
  onExit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
  send(request: RunRequest): boolean;
  interrupt(): void;
  kill(): void;
  readonly pid: number | undefined;
}

export interface LocalRunnerChannelFactory {
  create(pythonPath: string, daemonScript: string): LocalRunnerChannel;
}
