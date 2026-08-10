export interface RunnerProof {
  load(): Promise<{ runtime: string }>;
  execute(source: string): Promise<unknown>;
  interrupt(): Promise<{ status: "interrupted" }>;
  hardTimeout(
    source: string,
    timeoutMs: number,
  ): Promise<{ status: "timeout"; rebuilt: boolean }>;
  writeAndImport(
    files: Record<string, string>,
    entryFile: string,
  ): Promise<unknown>;
  isolatedRun(
    files: Record<string, string>,
    entryFile: string,
  ): Promise<unknown>;
}

declare global {
  interface Window {
    runnerProof: RunnerProof;
  }
}

export {};
