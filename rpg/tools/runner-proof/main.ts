import { PyodideClient } from "pyodide-worker-runner";
import { PythonRunnerAdapter } from "../../src/runners/python/adapter";
import type { RunRequest, RunResult } from "../../src/runners/protocol/types";
import type { RunnerProof } from "./types";

interface ClientSession {
  client: PyodideClient;
  generation: number;
  worker: Worker;
}

let generation = 0;
let session: ClientSession | undefined;
const strategyAdapter = new PythonRunnerAdapter();

function createSession(): ClientSession {
  let worker: Worker | undefined;
  const client = new PyodideClient(() => {
    const nextWorker = new Worker(new URL("./proof.worker.ts", import.meta.url), {
      type: "module",
    });

    worker = nextWorker;
    return nextWorker;
  });

  if (!worker) {
    throw new Error("The proof client did not create a Worker.");
  }

  const nextSession = { client, generation: ++generation, worker };

  session = nextSession;
  return nextSession;
}

function currentSession(): ClientSession {
  return session ?? createSession();
}

function wait(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
}

const runnerProof: RunnerProof = {
  load() {
    const active = currentSession();

    return active.client.call(active.client.workerProxy.runtime) as Promise<{
      runtime: string;
    }>;
  },
  execute(source) {
    const active = currentSession();

    return active.client.call(active.client.workerProxy.execute, source) as Promise<unknown>;
  },
  async interrupt() {
    const active = session;

    if (!active) {
      throw new Error("Cannot interrupt before the proof worker is loaded.");
    }

    await active.client.interrupt();
    return { status: "interrupted" };
  },
  async hardTimeout(source, timeoutMs) {
    const active = currentSession();
    const activeGeneration = active.generation;

    void active.client
      .call(active.client.workerProxy.execute, source)
      .catch(() => undefined);
    await wait(timeoutMs);

    if (session?.generation !== activeGeneration) {
      return { status: "timeout", rebuilt: true };
    }

    active.client.terminate();
    session = undefined;
    const rebuilt = createSession();

    return {
      status: "timeout",
      rebuilt:
        rebuilt.generation !== activeGeneration && rebuilt.worker !== active.worker,
    };
  },
  writeAndImport(files, entryFile) {
    const active = currentSession();

    return active.client.call(
      active.client.workerProxy.writeAndImport,
      files,
      entryFile,
    ) as Promise<unknown>;
  },
  isolatedRun(files, entryFile) {
    const active = currentSession();

    return active.client.call(
      active.client.workerProxy.writeAndImport,
      files,
      entryFile,
    ) as Promise<unknown>;
  },
};

Object.assign(runnerProof, {
  runRequest: (request: RunRequest): Promise<RunResult> => strategyAdapter.run(request),
  interruptRun: (runId: string): Promise<void> => strategyAdapter.interrupt(runId),
});

window.runnerProof = runnerProof;
