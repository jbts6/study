import type { RunRequest, RunResult } from "../protocol/types.ts";

export interface LocalRunnerChannel {
  readonly generation: number;
  readonly pid: number | undefined;
  onMessage: ((result: RunResult) => void) | undefined;
  onExit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
  waitReady(): Promise<void>;
  send(request: RunRequest): Promise<void>;
  interrupt(): void;
  kill(): Promise<void>;
}

export interface LocalRunnerChannelFactory {
  create(pythonPath: string, daemonScript: string): LocalRunnerChannel;
}
