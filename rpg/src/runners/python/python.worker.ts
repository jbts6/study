import * as Comlink from "comlink";
import {
  defaultPyodideLoader,
  initPyodide,
  pyodideExpose,
} from "pyodide-worker-runner";
import type { RunRequest, RunResult } from "../protocol/types";
import type { PythonWorkerApi } from "./worker-api";
import executeSource from "./runtime/execute.py?raw";

let runtime: Awaited<ReturnType<typeof defaultPyodideLoader>> | undefined;
let activeRunId: string | undefined;

async function initializeRuntime(): Promise<{
  state: "ready";
  runtimeVersion: string;
}> {
  if (runtime) return { state: "ready", runtimeVersion: runtime.version };

  runtime = await defaultPyodideLoader("314.0.3");
  initPyodide(runtime);
  await runtime.runPythonAsync(executeSource);
  return { state: "ready", runtimeVersion: runtime.version };
}

const initialize = pyodideExpose(async (_extras) => initializeRuntime());

const run = pyodideExpose(async (extras, request: RunRequest): Promise<RunResult> => {
  await initializeRuntime();
  const activeRuntime = runtime!;

  if (extras.interruptBuffer) {
    activeRuntime.setInterruptBuffer(extras.interruptBuffer);
  }

  const value = activeRuntime.toPy(request);
  activeRunId = request.runId;
  activeRuntime.globals.set("__runner_request__", value);

  try {
    return JSON.parse(
      String(
        await activeRuntime.runPythonAsync(
          "import json; json.dumps(execute_request(__runner_request__))",
        ),
      ),
    ) as RunResult;
  } finally {
    value.destroy();
    activeRuntime.globals.delete("__runner_request__");
    activeRunId = undefined;
  }
});

const interrupt = async (runId: string): Promise<void> => {
  if (runId !== activeRunId) return;
};

Comlink.expose({
  initialize: initialize as unknown as PythonWorkerApi["initialize"],
  run: run as unknown as PythonWorkerApi["run"],
  interrupt,
} satisfies PythonWorkerApi);
